import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, setSession, clearSession } from '../middlewares/auth.js';
import { registerSchema, loginSchema } from '../schemas/index.js';
import { audit } from '../utils/audit.js';
const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Trop de tentatives. Réessayez plus tard.' } });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const DUMMY = bcrypt.hashSync('dummy-password-for-timing', 12);
r.post('/register', limiter, validate(registerSchema), h(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError(409, 'Un compte existe déjà avec cet e-mail.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role, ...(role === 'YOUTH' ? { youthProfile: { create: {} } } : { company: { create: { name } } }) } });
  await audit(user.id, 'auth.register', 'user:' + user.id);
  setSession(res, user); ok(res, pub(user), 201);
}));
r.post('/login', limiter, validate(loginSchema), h(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  const good = await bcrypt.compare(password, user?.passwordHash || DUMMY); // temps constant : ne révèle pas si le compte existe
  if (!user || !good || user.status !== 'ACTIVE') throw new AppError(401, 'E-mail ou mot de passe incorrect.');
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') throw new AppError(403, 'Utilisez l’espace d’administration.');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  setSession(res, user); ok(res, pub(user));
}));
r.post('/logout', h(async (req, res) => { clearSession(res); ok(res); }));
r.get('/me', authenticate(), h(async (req, res) => ok(res, pub(req.user))));
export default r;
