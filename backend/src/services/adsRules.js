export const ADS_FLOW = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['SCHEDULED', 'REJECTED'],
  SCHEDULED: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: [],
};
/** Retourne un message d'erreur, ou null si la transition est autorisée. */
export function checkTransition(c, to, now = new Date()) {
  if (!(ADS_FLOW[c.status] || []).includes(to)) return `Transition interdite : ${c.status} → ${to}.`;
  if (to === 'ACTIVE') {
    if (!c.orderRef || !c.paymentConfirmedById) return 'Activation impossible : référence de commande ou de paiement et confirmation administrative traçable requises.';
    if (new Date(c.startsAt) > new Date(c.endsAt) || new Date(c.endsAt) < now) return 'Activation impossible : période invalide ou dépassée.';
  }
  return null;
}
/** Diffusable seulement si ACTIVE, dans sa période, sur un emplacement autorisé. */
export function isServable(c, placementId, now = new Date()) {
  return c.status === 'ACTIVE' && new Date(c.startsAt) <= now && new Date(c.endsAt) >= now && c.placementIds.includes(placementId);
}
export const ctr = (impressions, clicks) => (impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0);
