import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  FILE_SIGNING_SECRET: z.string().min(16).optional(),
  FRONTEND_ORIGIN: z.string().default('http://localhost:4000'),
  ADMIN_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SERVE_FRONTEND: z.enum(['true', 'false']).default('true'),
  FRONTEND_DIR: z.string().default('../frontend'),
  STORAGE_DIR: z.string().default('./storage'),
  AI_PROVIDER: z.enum(['anthropic', 'openai', 'none']).default('none'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  TRANSCRIBE_BASE_URL: z.string().optional(),
  TRANSCRIBE_API_KEY: z.string().optional(),
  TRANSCRIBE_MODEL: z.string().default('whisper-1'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('submissions'),
  PAYMENT_PROVIDER: z.enum(['sandbox', 'none']).default('sandbox'),
  ALLOW_SANDBOX_PAYMENTS: z.enum(['true', 'false']).default('false'),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PRO_PRICE_XOF: z.coerce.number().int().default(1450),
  PRO_DAYS: z.coerce.number().int().default(30),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});
const r = schema.safeParse(process.env);
if (!r.success) {
  console.error('Configuration invalide :\n' + r.error.issues.map((i) => ` - ${i.path.join('.')} : ${i.message}`).join('\n'));
  process.exit(1);
}
export const env = { ...r.data, isProd: r.data.NODE_ENV === 'production' };
env.FILE_SIGNING_SECRET ||= env.JWT_SECRET;
// Simulateur de paiement : jamais en production, sauf choix explicite (démonstration) avec ALLOW_SANDBOX_PAYMENTS=true.
env.sandboxPayments = env.PAYMENT_PROVIDER === 'sandbox' && (!env.isProd || env.ALLOW_SANDBOX_PAYMENTS === 'true');
if (env.isProd && env.sandboxPayments) console.warn('ATTENTION : simulateur de paiement ACTIF en production (démonstration). À désactiver avant tout lancement commercial.');
if (env.isProd && env.PAYMENT_PROVIDER === 'sandbox' && !env.sandboxPayments) console.warn('Simulateur de paiement désactivé en production : aucun paiement possible.');
