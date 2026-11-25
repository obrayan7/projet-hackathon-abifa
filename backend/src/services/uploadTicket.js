import crypto from 'node:crypto';
// Prouve qu'une clé de fichier a été délivrée à CET utilisateur (empêche de finaliser le fichier d'un autre).
export const makeTicket = (secret, userId, key) => crypto.createHmac('sha256', secret).update(`${userId}:${key}`).digest('hex');
export function checkTicket(secret, userId, key, ticket) {
  const a = Buffer.from(makeTicket(secret, userId, key)), b = Buffer.from(String(ticket || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
