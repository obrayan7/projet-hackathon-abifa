import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { checkoutSchema } from '../schemas/index.js';
import { getPlan } from '../services/data.js';
import { createCheckout } from '../services/paymentProvider.js';
import { applyPaymentEvent, verifySignature, sign } from '../services/paymentCore.js';
import { audit, notify } from '../utils/audit.js';
const r = Router();
const webhookSchema = z.object({ eventId: z.string().min(1).max(100), reference: z.string().min(1).max(100), amount: z.number().int(), currency: z.string().max(5), status: z.enum(['SUCCESS', 'FAILED', 'EXPIRED']) });
r.get('/subscriptions/me', authenticate(), h(async (req, res) => {
  const { plan, sub } = await getPlan(req.user.id);
  const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 10 });
  ok(res, { plan, endsAt: sub?.endsAt || null, price: env.PRO_PRICE_XOF, currency: 'XOF', history: payments.map((p) => ({ reference: p.reference, amount: p.amount, status: p.status, date: p.createdAt })) });
}));
r.post('/subscriptions/checkout', authenticate(), requireRole('YOUTH'), validate(checkoutSchema), h(async (req, res) => {
  const reference = 'SKP-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const c = await createCheckout({ reference, amount: env.PRO_PRICE_XOF, currency: 'XOF', user: req.user });
  const sub = await prisma.subscription.create({ data: { userId: req.user.id } });
  await prisma.payment.create({ data: { userId: req.user.id, subscriptionId: sub.id, provider: env.PAYMENT_PROVIDER, reference, amount: env.PRO_PRICE_XOF, currency: 'XOF' } });
  await audit(req.user.id, 'payment.checkout', 'payment:' + reference);
  ok(res, { reference, amount: env.PRO_PRICE_XOF, currency: 'XOF', checkoutUrl: c.checkoutUrl, sandbox: !!c.sandbox }, 201);
}));
/** Chemin UNIQUE d'activation de PRO : signature vérifiée, référence/montant/devise contrôlés, idempotent. */
export async function handleWebhook(provider, raw, signature) {
  if (provider !== env.PAYMENT_PROVIDER) throw new AppError(404, 'Prestataire inconnu.');
  if (!verifySignature(raw, signature, env.PAYMENT_WEBHOOK_SECRET)) throw new AppError(401, 'Signature invalide.');
  let evt;
  try { evt = webhookSchema.parse(JSON.parse(raw.toString('utf8'))); } catch { throw new AppError(400, 'Notification invalide.'); }
  const result = await prisma.$transaction((tx) => applyPaymentEvent(tx, { provider, ...evt }, { days: env.PRO_DAYS }));
  await audit(null, 'payment.webhook', 'payment:' + evt.reference, { outcome: Object.keys(result)[0], eventId: evt.eventId });
  if (result.activated) await notify(result.userId, 'subscription', 'Votre abonnement PRO est actif.');
  return result;
}
r.post('/payments/webhook/:provider', h(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  await handleWebhook(req.params.provider, raw, req.headers['x-signature']);
  ok(res); // toujours 200 pour un événement valide, même rejoué
}));
// Simulateur serveur (développement uniquement) : passe par le MÊME chemin signé que le vrai prestataire.
r.post('/payments/sandbox/confirm', authenticate(), requireRole('YOUTH'), h(async (req, res) => {
  if (!env.sandboxPayments || !env.PAYMENT_WEBHOOK_SECRET) throw new AppError(404, 'Ressource introuvable.');
  const pay = await prisma.payment.findFirst({ where: { reference: String(req.body?.reference || ''), userId: req.user.id } });
  if (!pay) throw new AppError(404, 'Commande introuvable.');
  const raw = JSON.stringify({ eventId: 'sbx-' + pay.reference, reference: pay.reference, amount: pay.amount, currency: pay.currency, status: 'SUCCESS' });
  ok(res, await handleWebhook('sandbox', Buffer.from(raw), sign(raw, env.PAYMENT_WEBHOOK_SECRET)));
}));
export default r;
