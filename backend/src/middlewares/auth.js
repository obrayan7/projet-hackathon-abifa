import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError, h } from '../utils/http.js';
export const COOKIE = 'sk_session';
/** aud 'app' : jeunes et entreprises (cookie HttpOnly). aud 'admin' : administration hébergée à part (jeton Bearer). */
export const signToken = (user, aud = 'app') => jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion }, env.JWT_SECRET, { expiresIn: aud === 'admin' ? '8h' : '7d', audience: aud });
export const setSession = (res, user) => {
  const token = signToken(user);
  res.cookie(COOKIE, token, { httpOnly: true, secure: env.isProd, sameSite: env.COOKIE_SAMESITE, maxAge: 7 * 864e5, path: '/' });
  return token;
};
export const clearSession = (res) => res.clearCookie(COOKIE, { httpOnly: true, secure: env.isProd, sameSite: env.COOKIE_SAMESITE, path: '/' });
export const authenticate = ({ required = true, aud = 'app' } = {}) => h(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const token = aud === 'admin' ? bearer : bearer || req.cookies?.[COOKIE];
  const fail = (msg) => { if (required) throw new AppError(401, msg); return next(); };
  if (!token) return fail('Authentification requise.');
  let p;
  try { p = jwt.verify(token, env.JWT_SECRET, { audience: aud }); } catch { return fail('Session expirée ou invalide.'); }
  // Le rôle et l'identité viennent TOUJOURS du jeton signé puis de la base, jamais d'un userId fourni par le navigateur.
  const user = await prisma.user.findUnique({ where: { id: p.sub } });
  if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== p.tv) return fail('Session invalide.');
  req.user = user; next();
});
export const requireRole = (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : next(new AppError(403, 'Accès refusé.')));
/** Protection CSRF des sessions par cookie : l'origine des requêtes d'écriture doit être autorisée. */
export const originGuard = (allowed) => (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.path.startsWith('/payments/webhook') || (req.headers.authorization || '').startsWith('Bearer ')) return next();
  const o = req.headers.origin;
  if (o && !allowed.includes(o)) return next(new AppError(403, 'Origine non autorisée.'));
  next();
};
