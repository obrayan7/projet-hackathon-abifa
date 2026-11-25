import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { h, ok, AppError, pageOf, paged } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { adSchema, adActionSchema } from '../../schemas/index.js';
import { safeHttpsUrl } from '../../utils/urls.js';
import { checkTransition, ctr } from '../../services/adsRules.js';
import { audit } from '../../utils/audit.js';
const r = Router();
const ACTIONS = { submit: 'PENDING_REVIEW', approve: 'APPROVED', schedule: 'SCHEDULED', activate: 'ACTIVE', pause: 'PAUSED', resume: 'ACTIVE', complete: 'COMPLETED', reject: 'REJECTED', archive: 'ARCHIVED', reopen: 'DRAFT' };
const dto = (c) => ({ id: c.id, advertiserName: c.advertiserName, advertiserCompanyId: c.advertiserCompanyId, name: c.name, title: c.title, text: c.text, destinationUrl: c.destinationUrl, mediaRef: c.mediaRef, ctaLabel: c.ctaLabel, status: c.status, startsAt: c.startsAt, endsAt: c.endsAt, frequencyCap: c.frequencyCap, orderRef: c.orderRef, paymentConfirmed: !!c.paymentConfirmedById, reviewNote: c.reviewNote,
  placementIds: c.placements.map((p) => p.placementId), impressions: c._count.impressions, clicks: c._count.clicks, ctr: ctr(c._count.impressions, c._count.clicks) });
const inc = { placements: true, _count: { select: { impressions: true, clicks: true } } };
async function clean(b) {
  const url = safeHttpsUrl(b.destinationUrl);
  if (!url) throw new AppError(400, 'Le lien de destination doit être une adresse https valide.');
  const media = b.mediaRef ? safeHttpsUrl(b.mediaRef) : null;
  if (b.mediaRef && !media) throw new AppError(400, 'L’adresse du visuel doit être une adresse https valide.');
  const places = await prisma.adPlacement.findMany({ where: { id: { in: b.placementIds }, active: true } });
  if (places.length !== new Set(b.placementIds).size) throw new AppError(400, 'Emplacement inconnu ou désactivé.');
  return { advertiserName: b.advertiserName, advertiserCompanyId: b.advertiserCompanyId || null, name: b.name, title: b.title, text: b.text, destinationUrl: url, mediaRef: media, ctaLabel: b.ctaLabel, startsAt: b.startsAt, endsAt: b.endsAt, frequencyCap: b.frequencyCap, orderRef: b.orderRef || null };
}
r.get('/', h(async (req, res) => {
  const p = pageOf(req), where = { ...(req.query.status ? { status: String(req.query.status) } : {}), ...(req.query.q ? { OR: [{ name: { contains: String(req.query.q).slice(0, 60), mode: 'insensitive' } }, { advertiserName: { contains: String(req.query.q).slice(0, 60), mode: 'insensitive' } }] } : {}) };
  const [rows, total] = await Promise.all([prisma.adCampaign.findMany({ where, include: inc, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }), prisma.adCampaign.count({ where })]);
  ok(res, paged(rows.map(dto), total, p));
}));
r.get('/:id', h(async (req, res) => { const c = await prisma.adCampaign.findUnique({ where: { id: req.params.id }, include: inc }); if (!c) throw new AppError(404, 'Campagne introuvable.'); ok(res, dto(c)); }));
r.post('/', validate(adSchema), h(async (req, res) => {
  const d = await clean(req.body);
  const c = await prisma.adCampaign.create({ data: { ...d, createdById: req.user.id, placements: { create: req.body.placementIds.map((placementId) => ({ placementId })) } } });
  await audit(req.user.id, 'ad.create', 'ad:' + c.id);
  ok(res, { id: c.id }, 201);
}));
r.patch('/:id', validate(adSchema), h(async (req, res) => {
  const c = await prisma.adCampaign.findUnique({ where: { id: req.params.id } });
  if (!c) throw new AppError(404, 'Campagne introuvable.');
  if (!['DRAFT', 'REJECTED'].includes(c.status)) throw new AppError(409, 'Une campagne ne peut être modifiée qu’en brouillon ou après un rejet.');
  const d = await clean(req.body);
  await prisma.adCampaignPlacement.deleteMany({ where: { campaignId: c.id } });
  await prisma.adCampaign.update({ where: { id: c.id }, data: { ...d, placements: { create: req.body.placementIds.map((placementId) => ({ placementId })) } } });
  await audit(req.user.id, 'ad.update', 'ad:' + c.id);
  ok(res);
}));
r.post('/:id/:action', validate(adActionSchema), h(async (req, res) => {
  const to = ACTIONS[req.params.action];
  if (!to) throw new AppError(404, 'Action inconnue.');
  const c = await prisma.adCampaign.findUnique({ where: { id: req.params.id } });
  if (!c) throw new AppError(404, 'Campagne introuvable.');
  const b = req.body, data = { status: to };
  if (['REJECTED'].includes(to)) { if (b.reason.length < 5) throw new AppError(400, 'Indiquez le motif du rejet.'); data.reviewNote = b.reason; }
  if (to === 'PAUSED' && b.reason.length < 5) throw new AppError(400, 'Indiquez le motif de la suspension.');
  const next = { ...c, orderRef: b.orderRef || c.orderRef };
  if (to === 'ACTIVE' && !c.paymentConfirmedById) {
    // Paiement hors plateforme : référence + confirmation administrative traçable (qui, quand, motif).
    if (!b.confirmPayment || b.reason.length < 5) throw new AppError(409, 'Activation impossible : confirmez le paiement (référence de vérification en motif).');
    Object.assign(next, { paymentConfirmedById: req.user.id });
    Object.assign(data, { paymentConfirmedById: req.user.id, paymentConfirmedAt: new Date(), orderRef: next.orderRef });
  }
  const err = checkTransition(next, to);
  if (err) throw new AppError(409, err);
  await prisma.adCampaign.update({ where: { id: c.id }, data });
  await audit(req.user.id, 'ad.' + req.params.action, 'ad:' + c.id, { from: c.status, to, reason: b.reason });
  ok(res);
}));
r.get('/:id/stats', h(async (req, res) => {
  const [imp, clk, byPlacement] = await Promise.all([prisma.adImpression.count({ where: { campaignId: req.params.id } }), prisma.adClick.count({ where: { campaignId: req.params.id } }), prisma.adImpression.groupBy({ by: ['placementId'], where: { campaignId: req.params.id }, _count: true })]);
  ok(res, { impressions: imp, clicks: clk, ctr: ctr(imp, clk), byPlacement: byPlacement.map((x) => ({ placement: x.placementId, impressions: x._count })), note: 'Mesures techniques indicatives : elles ne garantissent ni ventes, ni candidatures, ni conversions.' });
}));
export default r;
