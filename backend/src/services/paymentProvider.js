import { env } from '../config/env.js';
import { AppError } from '../utils/http.js';
/**
 * Adaptateur du prestataire de paiement (à choisir : disponibilité au Bénin, frais, API).
 * Pour brancher un prestataire : retourner { checkoutUrl } ici, puis configurer son webhook vers
 * POST /api/payments/webhook/<provider> avec la signature HMAC-SHA256 du corps brut dans l'en-tête x-signature.
 * Corps attendu : { eventId, reference, amount, currency, status: "SUCCESS" | "FAILED" | "EXPIRED" }.
 */
export async function createCheckout({ reference, amount, currency }) {
  if (env.sandboxPayments) return { checkoutUrl: null, sandbox: true };
  throw new AppError(503, 'Le paiement en ligne n’est pas encore disponible.');
}
