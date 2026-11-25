import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { originGuard } from './middlewares/auth.js';
import { notFound, errorHandler } from './middlewares/errors.js';
import auth from './routes/auth.js';
import youth from './routes/youth.js';
import ai from './routes/ai.js';
import challenges from './routes/challenges.js';
import jobs from './routes/jobs.js';
import companies from './routes/companies.js';
import subscriptions from './routes/subscriptions.js';
import ads from './routes/ads.js';
import misc from './routes/misc.js';
import admin from './routes/admin/index.js';
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:', 'https:'], mediaSrc: ["'self'", 'blob:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } },
  }));
  const origins = [env.FRONTEND_ORIGIN, env.ADMIN_ORIGIN];
  app.use('/api', cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '100kb' })); // corps brut : nécessaire à la vérification de signature
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Trop de requêtes.' } }));
  app.use('/api', originGuard(origins));
  app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
  app.use('/api/auth', auth);
  app.use('/api/youth', youth);
  app.use('/api/ai', ai);
  app.use('/api', challenges);
  app.use('/api', jobs);
  app.use('/api', companies);
  app.use('/api', subscriptions);
  app.use('/api/ads', ads);
  app.use('/api', misc);
  app.use('/api/admin', admin);
  app.use('/api', notFound);
  const dir = path.resolve(env.FRONTEND_DIR);
  if (env.SERVE_FRONTEND === 'true' && fs.existsSync(dir)) app.use(express.static(dir, { extensions: ['html'], index: 'index.html' }));
  app.use(errorHandler);
  return app;
}
