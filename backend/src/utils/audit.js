import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
/** Journal d'audit des actions sensibles : jamais de mot de passe, clé API ni donnée personnelle superflue. */
export async function audit(actorId, action, resource, meta = null, db = prisma) {
  try { await db.auditLog.create({ data: { actorId, action, resource, meta } }); } catch (e) { logger.error({ err: e.message }, 'audit failed'); }
}
export const notify = (userId, type, content, db = prisma) => db.notification.create({ data: { userId, type, content } }).catch(() => {});
