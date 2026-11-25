import { ZodError } from 'zod';
import { AppError } from '../utils/http.js';
import { logger } from '../config/logger.js';
export const notFound = (req, res) => res.status(404).json({ success: false, message: 'Ressource introuvable.' });
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.issues[0]?.message || 'Données invalides.', errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  if (err instanceof AppError) return res.status(err.status).json({ success: false, message: err.message, errors: err.errors });
  if (err.name === 'MulterError') return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop lourd.' : 'Envoi de fichier invalide.' });
  if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Cet élément existe déjà.' });
  if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
  logger.error({ err: err.message, stack: err.stack, url: req.url }, 'unhandled');
  res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
}
