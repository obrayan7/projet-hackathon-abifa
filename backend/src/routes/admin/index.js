import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../config/prisma.js';
import { h, ok, AppError, pageOf, paged } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireRole, signToken } from '../../middlewares/auth.js';
import { adminLoginSchema, reasonSchema, reviewSchema } from '../../schemas/index.js';
import { audit, notify } from '../../utils/audit.js';
import { recomputeSkill, subDto } from '../../services/data.js';
import adsRouter from './ads.js';
const r = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Trop de tentatives. Réessayez plus tard.' } });
const DUMMY = bcrypt.hashSync('dummy-password-for-timing', 12);
// L'administration est hébergée à part : authentification par jeton Bearer (audience "admin"), distincte de la session des jeunes/entreprises.
r.post('/auth/login', loginLimit, validate(adminLoginSchema), h(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  const good = await bcrypt.compare(req.body.password, user?.passwordHash || DUMMY);
  if (!user || !good || user.status !== 'ACTIVE' || !['ADMIN', 'MODERATOR'].includes(user.role)) throw new AppError(401, 'Identifiants incorrects.');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(user.id, 'admin.login', 'user:' + user.id);
  ok(res, { token: signToken(user, 'admin'), user: { id: user.id, name: user.name, role: user.role } });
}));
r.use(authenticate({ aud: 'admin' }), requireRole('ADMIN', 'MODERATOR'));
const adminOnly = requireRole('ADMIN');
r.get('/me', h(async (req, res) => ok(res, { id: req.user.id, name: req.user.name, role: req.user.role })));
const CLOSED = { OPEN: 0 };
r.get('/stats', h(async (req, res) => {
  const since = new Date(Date.now() - 6 * 864e5); since.setHours(0, 0, 0, 0);
  const [users, companies, jobsPub, pro, adsLive, pendingCos, openReports, openAppeals, payIssues, adsReview, subsPending, recent, roles, jobStatus, repDone, repAll] = await Promise.all([
    prisma.user.count(), prisma.company.count(), prisma.job.count({ where: { status: 'PUBLISHED' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endsAt: { gt: new Date() } } }),
    prisma.adCampaign.count({ where: { status: 'ACTIVE', startsAt: { lte: new Date() }, endsAt: { gte: new Date() } } }),
    prisma.company.count({ where: { verification: 'PENDING' } }), prisma.report.count({ where: { status: 'OPEN' } }), prisma.evaluation.count({ where: { appealStatus: 'OPEN' } }),
    prisma.payment.count({ where: { status: { in: ['FAILED', 'PENDING'] } } }), prisma.adCampaign.count({ where: { status: 'PENDING_REVIEW' } }), prisma.submission.count({ where: { status: 'PENDING' } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }), prisma.user.groupBy({ by: ['role'], _count: true }), prisma.job.groupBy({ by: ['status'], _count: true }),
    prisma.report.count({ where: { status: { not: 'OPEN' } } }), prisma.report.count()]);
  const signups = Array.from({ length: 7 }, (_, i) => { const d = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10); return recent.filter((u) => u.createdAt.toISOString().slice(0, 10) === d).length; });
  ok(res, { users, companies, jobsPublished: jobsPub, proActive: pro, adsLive, signups, roles: Object.fromEntries(roles.map((x) => [x.role, x._count])), jobStatus: Object.fromEntries(jobStatus.map((x) => [x.status, x._count])), reports: { done: repDone, total: repAll },
    alerts: { companiesPending: pendingCos, reportsOpen: openReports, appealsOpen: openAppeals, paymentsIssues: payIssues, adsToReview: adsReview, submissionsPending: subsPending } });
}));
const like = (q, fields) => (q ? { OR: fields.map((f) => ({ [f]: { contains: String(q).slice(0, 60), mode: 'insensitive' } })) } : {});
const list = (model, build) => h(async (req, res) => {
  const p = pageOf(req), { where, include, orderBy, map } = await build(req);
  const [rows, total] = await Promise.all([prisma[model].findMany({ where, include, orderBy: orderBy || { createdAt: 'desc' }, skip: p.skip, take: p.take }), prisma[model].count({ where })]);
  ok(res, paged(await Promise.all(rows.map(map)), total, p));
});
const st = (req) => (req.query.status ? { status: String(req.query.status) } : {});
r.get('/users', adminOnly, list('user', (req) => ({ where: { ...like(req.query.q, ['name', 'email']), ...st(req), ...(req.query.role ? { role: String(req.query.role) } : {}) }, include: { subscriptions: { where: { status: 'ACTIVE', endsAt: { gt: new Date() } }, take: 1 } },
  map: (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, plan: u.subscriptions.length ? 'PRO' : 'FREE', createdAt: u.createdAt }) })));
r.patch('/users/:id/status', adminOnly, validate(reasonSchema), h(async (req, res) => {
  const status = req.body.status, u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u || !['ACTIVE', 'SUSPENDED'].includes(status)) throw new AppError(400, 'Requête invalide.');
  if (u.id === req.user.id || ['ADMIN', 'MODERATOR'].includes(u.role)) throw new AppError(403, 'Ce compte ne peut pas être modifié ici.');
  await prisma.user.update({ where: { id: u.id }, data: { status, ...(status === 'SUSPENDED' ? { tokenVersion: { increment: 1 } } : {}) } }); // suspendre = déconnecter partout
  await audit(req.user.id, 'user.' + status.toLowerCase(), 'user:' + u.id, { reason: req.body.reason });
  ok(res);
}));
r.get('/companies', adminOnly, list('company', (req) => ({ where: { ...like(req.query.q, ['name', 'sector']), ...(req.query.status ? { verification: String(req.query.status) } : {}) }, include: { _count: { select: { jobs: true } } }, orderBy: { name: 'asc' },
  map: (c) => ({ id: c.id, name: c.name, sector: c.sector, jobs: c._count.jobs, status: c.verification }) })));
r.patch('/companies/:id/verification', adminOnly, validate(reasonSchema), h(async (req, res) => {
  if (!['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].includes(req.body.status)) throw new AppError(400, 'Statut invalide.');
  const c = await prisma.company.update({ where: { id: req.params.id }, data: { verification: req.body.status } });
  await audit(req.user.id, 'company.' + req.body.status.toLowerCase(), 'company:' + c.id, { reason: req.body.reason });
  await notify(c.ownerUserId, 'company', 'Le statut de votre compte entreprise a été mis à jour.');
  ok(res);
}));
r.get('/jobs', list('job', (req) => ({ where: { ...like(req.query.q, ['title']), ...st(req) }, include: { company: true, _count: { select: { applications: true } } }, map: (j) => ({ id: j.id, name: j.title, company: j.company.name, applications: j._count.applications, status: j.status }) })));
r.patch('/jobs/:id/status', validate(reasonSchema), h(async (req, res) => {
  if (!['PUBLISHED', 'SUSPENDED', 'CLOSED', 'IN_REVIEW'].includes(req.body.status)) throw new AppError(400, 'Statut invalide.');
  const j = await prisma.job.update({ where: { id: req.params.id }, data: { status: req.body.status }, include: { company: true } });
  await audit(req.user.id, 'job.' + req.body.status.toLowerCase(), 'job:' + j.id, { reason: req.body.reason });
  await notify(j.company.ownerUserId, 'job', `Votre mission « ${j.title} » a été mise à jour par l’administration.`);
  ok(res);
}));
r.get('/challenges', adminOnly, list('challenge', (req) => ({ where: { ...like(req.query.q, ['title']), ...st(req) }, include: { skill: true }, map: (c) => ({ id: c.id, name: c.title, skill: c.skill.name, level: c.difficulty, source: c.source, status: c.status }) })));
r.patch('/challenges/:id/status', adminOnly, validate(reasonSchema), h(async (req, res) => {
  if (!['PUBLISHED', 'ARCHIVED', 'DRAFT'].includes(req.body.status)) throw new AppError(400, 'Statut invalide.');
  await prisma.challenge.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await audit(req.user.id, 'challenge.' + req.body.status.toLowerCase(), 'challenge:' + req.params.id, { reason: req.body.reason });
  ok(res);
}));
r.get('/submissions', list('submission', (req) => ({ where: { ...(req.query.status ? { status: String(req.query.status) } : {}), ...(req.query.q ? { OR: [{ user: { name: { contains: String(req.query.q).slice(0, 60), mode: 'insensitive' } } }, { challenge: { title: { contains: String(req.query.q).slice(0, 60), mode: 'insensitive' } } }] } : {}) },
  include: { user: true, challenge: { include: { skill: true } }, evaluation: true }, map: (s) => ({ ...subDto(s), user: s.user.name, name: s.user.name + ' · ' + s.challenge.title }) })));
r.patch('/submissions/:id/review', validate(reviewSchema), h(async (req, res) => {
  const { decision, comment } = req.body;
  if (decision === 'REVISION' && comment.length < 5) throw new AppError(400, 'Expliquez au jeune ce qu’il doit améliorer (5 caractères minimum).');
  const s = await prisma.submission.findUnique({ where: { id: req.params.id }, include: { challenge: true } });
  if (!s) throw new AppError(404, 'Livrable introuvable.');
  if (s.status !== 'PENDING') throw new AppError(409, 'Ce livrable a déjà été traité.');
  await prisma.$transaction(async (tx) => {
    await tx.submission.update({ where: { id: s.id }, data: { status: decision, reviewedAt: new Date() } });
    await tx.evaluation.upsert({ where: { submissionId: s.id }, update: { result: decision, comment, evaluatorId: req.user.id }, create: { submissionId: s.id, evaluatorId: req.user.id, result: decision, comment } });
    if (decision === 'VALIDATED') await tx.proof.upsert({ where: { submissionId: s.id }, update: {}, create: { userId: s.userId, submissionId: s.id, skillId: s.challenge.skillId } });
    else await tx.proof.deleteMany({ where: { submissionId: s.id } });
  });
  await recomputeSkill(s.userId, s.challenge.skillId);
  await audit(req.user.id, 'submission.' + decision.toLowerCase(), 'submission:' + s.id, { comment: comment.slice(0, 120) });
  await notify(s.userId, 'submission', decision === 'VALIDATED' ? `Votre livrable « ${s.challenge.title} » est validé.` : `Votre livrable « ${s.challenge.title} » doit être amélioré.`);
  ok(res);
}));
r.get('/evaluations', list('evaluation', (req) => ({ where: { appealStatus: req.query.status ? String(req.query.status) : { not: 'NONE' } }, include: { submission: { include: { user: true, challenge: true } } }, map: (e) => ({ id: e.id, name: e.submission.user.name + ' · ' + e.submission.challenge.title, comment: e.comment, appealReason: e.appealReason, status: e.appealStatus }) })));
r.patch('/evaluations/:id/appeal', validate(reasonSchema), h(async (req, res) => {
  const decision = req.body.status;
  if (!['MAINTAINED', 'REVISED'].includes(decision)) throw new AppError(400, 'Décision invalide.');
  const ev = await prisma.evaluation.update({ where: { id: req.params.id }, data: { appealStatus: decision, appealResolution: req.body.reason }, include: { submission: { include: { challenge: true } } } });
  if (decision === 'REVISED') { // le livrable repasse en examen
    await prisma.submission.update({ where: { id: ev.submissionId }, data: { status: 'PENDING', reviewedAt: null } });
    await prisma.proof.deleteMany({ where: { submissionId: ev.submissionId } });
    await recomputeSkill(ev.submission.userId, ev.submission.challenge.skillId);
  }
  await audit(req.user.id, 'evaluation.appeal.' + decision.toLowerCase(), 'evaluation:' + ev.id, { reason: req.body.reason });
  await notify(ev.submission.userId, 'evaluation', 'Votre contestation a été examinée.');
  ok(res);
}));
r.get('/reports', list('report', (req) => ({ where: { ...st(req), ...like(req.query.q, ['reason']) }, include: { reporter: true }, map: (x) => ({ id: x.id, name: `${x.targetType} ${x.targetId}`, type: x.targetType, reason: x.reason, resolution: x.resolution, status: x.status }) })));
r.patch('/reports/:id', validate(reasonSchema), h(async (req, res) => {
  if (!['RESOLVED', 'REJECTED'].includes(req.body.status)) throw new AppError(400, 'Statut invalide.');
  await prisma.report.update({ where: { id: req.params.id }, data: { status: req.body.status, resolution: req.body.reason, handledBy: req.user.id } });
  await audit(req.user.id, 'report.' + req.body.status.toLowerCase(), 'report:' + req.params.id, { reason: req.body.reason });
  ok(res);
}));
r.get('/payments', adminOnly, list('payment', (req) => ({ where: { ...st(req), ...like(req.query.q, ['reference']) }, include: { user: true }, map: (p) => ({ id: p.id, reference: p.reference, user: p.user.name, amount: p.amount, currency: p.currency, provider: p.provider, status: p.status, createdAt: p.createdAt }) })));
r.get('/audit', adminOnly, list('auditLog', (req) => ({ where: like(req.query.q, ['action', 'resource']), map: (l) => ({ id: l.id, createdAt: l.createdAt, actor: l.actorId, action: l.action, resource: l.resource, reason: l.meta?.reason || l.meta?.comment || '' }) })));
r.get('/placements', h(async (req, res) => ok(res, await prisma.adPlacement.findMany({ orderBy: { name: 'asc' } }))));
r.patch('/placements/:id', adminOnly, h(async (req, res) => {
  const p = await prisma.adPlacement.update({ where: { id: req.params.id }, data: { active: !!req.body.active } });
  await audit(req.user.id, 'placement.' + (p.active ? 'on' : 'off'), 'placement:' + p.id);
  ok(res, p);
}));
r.use('/ads', adminOnly, adsRouter);
export default r;
