import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { discoverSchema, decomposeSchema } from '../schemas/index.js';
import { discoverSkills, decomposeJob, transcribe } from '../services/ai.js';
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1048576, files: 1 } });
const aiLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.user?.id || req.ip, message: { success: false, message: 'Trop de demandes à l’IA. Patientez quelques minutes.' } });
const discover = h(async (req, res) => {
  const result = await discoverSkills(req.body.text);
  await prisma.aiProposal.create({ data: { userId: req.user.id, payload: result } });
  ok(res, result);
});
r.post('/skills/discover', authenticate(), requireRole('YOUTH'), aiLimit, validate(discoverSchema), discover);
r.post('/jobs/decompose', authenticate(), requireRole('COMPANY'), aiLimit, validate(decomposeSchema), h(async (req, res) => ok(res, await decomposeJob(req.body))));
r.post('/transcribe', authenticate(), requireRole('YOUTH'), aiLimit, upload.single('audio'), h(async (req, res) => {
  if (!req.file || !/^audio\//.test(req.file.mimetype) && req.file.mimetype !== 'video/webm') throw new AppError(400, 'Fichier audio requis.');
  const text = await transcribe(req.file.buffer, req.file.mimetype).catch(() => { throw new AppError(502, 'La transcription a échoué.'); });
  if (text === null) throw new AppError(501, 'La transcription n’est pas configurée.');
  ok(res, { text });
}));
export default r;
