import crypto from 'node:crypto';
export const sign = (raw, secret) => crypto.createHmac('sha256', secret).update(raw).digest('hex');
export function verifySignature(raw, signature, secret) {
  if (!secret || !signature) return false;
  const a = Buffer.from(sign(raw, secret)), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/**
 * Applique un événement de paiement DÉJÀ VÉRIFIÉ (signature), de façon idempotente. À appeler dans une transaction.
 * Le retour du navigateur n'est jamais une preuve : seul ce chemin serveur active PRO.
 */
export async function applyPaymentEvent(tx, evt, cfg) {
  const { provider, eventId, reference, amount, currency, status } = evt;
  try {
    await tx.webhookEvent.create({ data: { provider, eventId, reference } });
  } catch (e) {
    if (e && e.code === 'P2002') return { duplicate: true };
    throw e;
  }
  const pay = await tx.payment.findUnique({ where: { reference } });
  if (!pay || pay.provider !== provider) return { rejected: 'commande inconnue' };
  if (pay.status === 'CONFIRMED') return { duplicate: true };
  if (status !== 'SUCCESS') {
    await tx.payment.update({ where: { id: pay.id }, data: { status: status === 'EXPIRED' ? 'EXPIRED' : 'FAILED' } });
    return { failed: true };
  }
  if (amount !== pay.amount || currency !== pay.currency) return { rejected: 'montant ou devise différents de la commande' };
  const now = new Date();
  const current = await tx.subscription.findFirst({ where: { userId: pay.userId, status: 'ACTIVE', endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
  const startsAt = current ? current.endsAt : now;
  const endsAt = new Date(startsAt.getTime() + cfg.days * 864e5);
  await tx.payment.update({ where: { id: pay.id }, data: { status: 'CONFIRMED', confirmedAt: now } });
  await tx.subscription.update({ where: { id: pay.subscriptionId }, data: { status: 'ACTIVE', startsAt, endsAt } });
  return { activated: true, userId: pay.userId, endsAt };
}
