import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { reportSchema } from '../schemas/index.js';
import { verifySigned, openFile, remote, isRemote } from '../utils/storage.js';
import { audit } from '../utils/audit.js';
const r = Router();
const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', docx: 'application/octet-stream', doc: 'application/octet-stream' };
r.post('/reports', authenticate(), validate(reportSchema), h(async (req, res) => {
  const rep = await prisma.report.create({ data: { reporterId: req.user.id, ...req.body } });
  await audit(req.user.id, 'report.create', 'report:' + rep.id);
  ok(res, { id: rep.id }, 201);
}));
r.get('/notifications', authenticate(), h(async (req, res) => ok(res, await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 30 }))));
r.patch('/notifications/read', authenticate(), h(async (req, res) => { await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } }); ok(res); }));
// Fichiers privés : accessibles uniquement via une URL signée à durée limitée.
r.get('/config', (req, res) => ok(res, { uploadMode: isRemote ? 'direct' : 'multipart' }));
r.get('/files/:key', async (req, res, next) => {
  const { exp, sig } = req.query;
  if (!verifySigned(req.params.key, exp, sig)) return next(new AppError(403, 'Lien expiré ou invalide.'));
  if (isRemote) { // lecture directe depuis Supabase par une URL signée de 5 min : le fichier ne passe pas par l'API
    try { const img = /\.(png|jpg|gif|webp)$/.test(req.params.key); return res.redirect(302, await remote.downloadUrl(req.params.key, 300, img ? undefined : req.params.key)); } catch (e) { return next(new AppError(502, 'Stockage indisponible.')); }
  }
  const s = openFile(req.params.key);
  if (!s) return next(new AppError(404, 'Fichier introuvable.'));
  const ext = req.params.key.split('.').pop(), type = MIME[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Disposition', /^(image|video)\/|pdf/.test(type) ? 'inline' : 'attachment');
  s.on('error', () => res.destroy()); s.pipe(res);
});
export default r;
