import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { adEventSchema } from '../schemas/index.js';
import { isServable } from '../services/adsRules.js';
const r = Router();
const limit = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const key = (req) => crypto.createHmac('sha256', env.JWT_SECRET).update(req.user?.id || req.ip || 'anon').digest('hex').slice(0, 24); // identifiant technique minimisé
const live = (placement) => prisma.adCampaign.findMany({ where: { status: 'ACTIVE', startsAt: { lte: new Date() }, endsAt: { gte: new Date() }, placements: { some: { placementId: placement, placement: { active: true } } } }, include: { placements: true } });
const servable = (c, placement) => isServable({ ...c, placementIds: c.placements.map((p) => p.placementId) }, placement);
r.get('/eligible', limit, authenticate({ required: false }), h(async (req, res) => {
  const placement = String(req.query.placement || '').slice(0, 40), k = key(req), since = new Date(Date.now() - 864e5);
  const out = [];
  for (const c of (await live(placement)).filter((c) => servable(c, placement))) {
    const seen = await prisma.adImpression.count({ where: { campaignId: c.id, userKey: k, createdAt: { gte: since } } });
    if (seen < c.frequencyCap) out.push(c);
  }
  const c = out[Math.floor(Math.random() * out.length)];
  // Les annonces sont séparées du matching : aucun score, aucune donnée personnelle transmise à l'annonceur.
  ok(res, c ? { id: c.id, label: 'Sponsorisé', advertiser: c.advertiserName, title: c.title, text: c.text, ctaLabel: c.ctaLabel, mediaUrl: c.mediaRef } : null);
}));
const record = (model) => h(async (req, res) => {
  const placement = req.body.placement, k = key(req);
  const c = (await live(placement)).find((x) => x.id === req.params.id && servable(x, placement));
  if (!c) throw new AppError(404, 'Annonce indisponible.');
  const recent = await prisma[model].count({ where: { campaignId: c.id, userKey: k, placementId: placement, createdAt: { gte: new Date(Date.now() - (model === 'adClick' ? 60e3 : 30 * 60e3)) } } });
  if (!recent) await prisma[model].create({ data: { campaignId: c.id, placementId: placement, userKey: k } });
  ok(res, model === 'adClick' ? { url: c.destinationUrl } : null);
});
r.post('/:id/impressions', limit, authenticate({ required: false }), validate(adEventSchema), record('adImpression'));
r.post('/:id/click', limit, authenticate({ required: false }), validate(adEventSchema), record('adClick'));
export default r;
