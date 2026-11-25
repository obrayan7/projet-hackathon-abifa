import { Router } from 'express';
import path from 'node:path';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { submissionSchema, appealSchema, uploadUrlSchema } from '../schemas/index.js';
import { makeTicket, checkTicket } from '../services/uploadTicket.js';
import { checkFile, MIME_EXT, kindOfMime, LIMITS_MB } from '../utils/fileSniff.js';
import { safeHttpsUrl } from '../utils/urls.js';
import { saveFile, remote, isRemote, validKey } from '../utils/storage.js';
import { recomputeSkill, subDto, chalDto } from '../services/data.js';
import { audit } from '../utils/audit.js';
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1048576, files: 1 } });
const subLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.user?.id || req.ip, message: { success: false, message: 'Trop d’envois. Réessayez plus tard.' } });
const youth = [authenticate(), requireRole('YOUTH')];
const accessible = (u) => ({ status: 'PUBLISHED', OR: [{ ownerUserId: null }, { ownerUserId: u.id }], skill: { userSkills: { some: { userId: u.id } } } });
r.get('/challenges', ...youth, h(async (req, res) => ok(res, (await prisma.challenge.findMany({ where: accessible(req.user), include: { skill: true }, orderBy: { createdAt: 'asc' } })).map(chalDto))));
r.get('/challenges/:id', ...youth, h(async (req, res) => {
  const c = await prisma.challenge.findFirst({ where: { id: req.params.id, ...accessible(req.user) }, include: { skill: true } });
  if (!c) throw new AppError(404, 'Défi introuvable.');
  ok(res, chalDto(c));
}));
// Dépôt direct (Supabase) : l'API délivre une URL signée, le navigateur y envoie le fichier, puis l'API vérifie le fichier déposé.
r.post('/submissions/upload-url', ...youth, subLimit, validate(uploadUrlSchema), h(async (req, res) => {
  if (!isRemote) throw new AppError(400, 'Le dépôt direct n’est pas configuré sur ce serveur.');
  const { challengeId, kind, size, mime } = req.body;
  if (kindOfMime(mime) !== kind || !MIME_EXT[mime]) throw new AppError(400, 'Ce format de fichier n’est pas accepté pour ce type de livrable.');
  if (size > LIMITS_MB[kind] * 1048576) throw new AppError(400, `Fichier trop lourd (maximum ${LIMITS_MB[kind]} Mo).`);
  if (!(await prisma.challenge.findFirst({ where: { id: challengeId, ...accessible(req.user) } }))) throw new AppError(404, 'Défi introuvable ou non accessible.');
  const key = `${crypto.randomUUID()}.${MIME_EXT[mime]}`;
  ok(res, { key, uploadUrl: await remote.uploadTarget(key), ticket: makeTicket(env.FILE_SIGNING_SECRET, req.user.id, key), contentType: mime });
}));
r.post('/submissions', ...youth, subLimit, upload.single('file'), validate(submissionSchema), h(async (req, res) => {
  const { challengeId, kind, url, description } = req.body, u = req.user;
  const ch = await prisma.challenge.findFirst({ where: { id: challengeId, ...accessible(u) } });
  if (!ch) throw new AppError(404, 'Défi introuvable ou non accessible.');
  if (await prisma.submission.findFirst({ where: { userId: u.id, challengeId, status: { in: ['PENDING', 'VALIDATED'] } } })) throw new AppError(409, 'Un livrable est déjà en attente de validation ou validé pour ce défi.');
  const data = { challengeId, userId: u.id, kind, description };
  if (kind === 'LINK') {
    const safe = safeHttpsUrl(url || '');
    if (!safe) throw new AppError(400, 'Le lien doit commencer par https://');
    data.url = safe;
  } else if (req.body.fileKey) {
    const { fileKey, ticket, fileName } = req.body;
    if (!isRemote || !validKey(fileKey) || !checkTicket(env.FILE_SIGNING_SECRET, u.id, fileKey, ticket)) throw new AppError(403, 'Dépôt non autorisé.');
    if (await prisma.submission.findFirst({ where: { fileKey } })) throw new AppError(409, 'Ce fichier est déjà utilisé.');
    const info = await remote.inspect(fileKey);
    if (!info) throw new AppError(400, 'Fichier introuvable : réessayez l’envoi.');
    const c = checkFile(kind, info.head, info.size);
    if (c.error) { await remote.remove(fileKey).catch(() => {}); throw new AppError(400, c.error); } // type réel et taille vérifiés sur le fichier déposé
    Object.assign(data, { fileKey, fileName: path.basename(fileName || 'fichier').replace(/[^\w.\- ]/g, '_').slice(0, 100), mime: c.type.mime, size: info.size });
  } else {
    if (isRemote) throw new AppError(400, 'Utilisez le dépôt direct pour envoyer un fichier.');
    if (!req.file) throw new AppError(400, 'Choisissez un fichier à envoyer.');
    const c = checkFile(kind, req.file.buffer);
    if (c.error) throw new AppError(400, c.error);
    Object.assign(data, { fileKey: await saveFile(req.file.buffer, c.type.ext), fileName: path.basename(req.file.originalname).replace(/[^\w.\- ]/g, '_').slice(0, 100), mime: c.type.mime, size: req.file.size });
  }
  const sub = await prisma.submission.create({ data, include: { challenge: { include: { skill: true } }, evaluation: true } });
  await recomputeSkill(u.id, ch.skillId);
  await audit(u.id, 'submission.create', 'submission:' + sub.id, { kind });
  ok(res, subDto(sub), 201);
}));
r.get('/submissions/me', ...youth, h(async (req, res) => ok(res, (await prisma.submission.findMany({ where: { userId: req.user.id }, include: { challenge: { include: { skill: true } }, evaluation: true }, orderBy: { createdAt: 'desc' } })).map(subDto))));
r.post('/evaluations/:id/appeal', ...youth, validate(appealSchema), h(async (req, res) => {
  const ev = await prisma.evaluation.findFirst({ where: { id: req.params.id, submission: { userId: req.user.id } } });
  if (!ev) throw new AppError(404, 'Évaluation introuvable.');
  if (ev.appealStatus !== 'NONE') throw new AppError(409, 'Une contestation a déjà été déposée.');
  await prisma.evaluation.update({ where: { id: ev.id }, data: { appealStatus: 'OPEN', appealReason: req.body.reason } });
  await audit(req.user.id, 'evaluation.appeal', 'evaluation:' + ev.id);
  ok(res);
}));
export default r;
