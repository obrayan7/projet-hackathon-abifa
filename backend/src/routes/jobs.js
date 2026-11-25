import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError, pageOf, paged } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { jobSchema, jobStatusSchema, applySchema, appStatusSchema } from '../schemas/index.js';
import { jobDto, getPlan, loadPublishedJobs, haveMap } from '../services/data.js';
import { recommendationsFor } from '../services/matching.js';
import { loadTalents, talentDto } from '../services/talents.js';
import { audit, notify } from '../utils/audit.js';
const r = Router();
const company = [authenticate(), requireRole('COMPANY')];
export const companyOf = async (req) => { const c = await prisma.company.findUnique({ where: { ownerUserId: req.user.id } }); if (!c) throw new AppError(404, 'Profil entreprise introuvable.'); return c; };
export const ownedJob = async (req) => {
  const co = await companyOf(req);
  const job = await prisma.job.findFirst({ where: { id: req.params.id, companyId: co.id }, include: { skills: { include: { skill: true } }, company: true } });
  if (!job) throw new AppError(404, 'Mission introuvable.'); // même réponse si elle appartient à une autre entreprise
  return job;
};
const skillRows = async (names) => {
  const rows = await prisma.skill.findMany({ where: { name: { in: names } } });
  if (rows.length !== new Set(names).size) throw new AppError(400, 'Une des compétences demandées n’existe pas dans le catalogue.');
  return rows;
};
r.get('/skills', h(async (req, res) => ok(res, (await prisma.skill.findMany({ orderBy: { name: 'asc' } })).map((s) => ({ id: s.id, name: s.name, category: s.category })))));
r.get('/jobs', h(async (req, res) => {
  const p = pageOf(req), q = String(req.query.q || '').slice(0, 60), where = { status: 'PUBLISHED', ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) };
  const [items, total] = await Promise.all([prisma.job.findMany({ where, include: { company: true, skills: { include: { skill: true } } }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }), prisma.job.count({ where })]);
  ok(res, paged(items.map(jobDto), total, p));
}));
r.get('/jobs/:id', h(async (req, res) => {
  const j = await prisma.job.findFirst({ where: { id: req.params.id, status: 'PUBLISHED' }, include: { company: true, skills: { include: { skill: true } } } });
  if (!j) throw new AppError(404, 'Mission introuvable.');
  ok(res, jobDto(j));
}));
const writeJob = async (b, co, jobId) => {
  const rows = await skillRows(b.skills);
  const data = { title: b.title, description: b.description, deliverables: b.deliverables, budgetMin: b.budgetMin, budgetMax: b.budgetMax, deadline: b.deadline, mode: b.mode, location: b.location, subtasks: b.subtasks };
  if (!jobId) return prisma.job.create({ data: { ...data, companyId: co.id, status: co.verification === 'VERIFIED' ? 'PUBLISHED' : 'IN_REVIEW', skills: { create: rows.map((s) => ({ skillId: s.id })) } } });
  await prisma.jobSkill.deleteMany({ where: { jobId } });
  return prisma.job.update({ where: { id: jobId }, data: { ...data, skills: { create: rows.map((s) => ({ skillId: s.id })) } } });
};
r.post('/jobs', ...company, validate(jobSchema), h(async (req, res) => {
  const co = await companyOf(req);
  if (['REJECTED', 'SUSPENDED'].includes(co.verification)) throw new AppError(403, 'Votre compte entreprise ne permet pas de publier.');
  const job = await writeJob(req.body, co);
  await audit(req.user.id, 'job.create', 'job:' + job.id);
  ok(res, { id: job.id, status: job.status }, 201);
}));
r.put('/jobs/:id', ...company, validate(jobSchema), h(async (req, res) => {
  const job = await ownedJob(req);
  if (job.status === 'SUSPENDED') throw new AppError(403, 'Cette mission est suspendue par l’administration.');
  await writeJob(req.body, job.company, job.id);
  await audit(req.user.id, 'job.update', 'job:' + job.id);
  ok(res);
}));
r.patch('/jobs/:id/status', ...company, validate(jobStatusSchema), h(async (req, res) => {
  const job = await ownedJob(req);
  if (['SUSPENDED', 'IN_REVIEW'].includes(job.status)) throw new AppError(403, 'Seule l’administration peut modifier le statut de cette mission.');
  await prisma.job.update({ where: { id: job.id }, data: { status: req.body.status } });
  await audit(req.user.id, 'job.status', 'job:' + job.id, { status: req.body.status });
  ok(res);
}));
r.get('/jobs/:id/matches', ...company, h(async (req, res) => {
  const job = await ownedJob(req), favs = new Set((await prisma.favorite.findMany({ where: { companyId: job.companyId } })).map((f) => f.userId));
  ok(res, (await loadTalents()).map((u) => talentDto(u, job, favs)).filter((t) => t.fit.have.length).sort((a, b) => b.score - a.score).slice(0, 50));
}));
r.get('/jobs/:id/applications', ...company, h(async (req, res) => {
  const job = await ownedJob(req);
  const apps = await prisma.application.findMany({ where: { jobId: job.id }, orderBy: { createdAt: 'desc' } });
  const users = new Map((await loadTalents()).map((u) => [u.id, u]));
  ok(res, apps.map((a) => ({ id: a.id, status: a.status, message: a.message, createdAt: a.createdAt, talent: users.has(a.userId) ? talentDto(users.get(a.userId), job) : null })));
}));
r.post('/jobs/:id/applications', authenticate(), requireRole('YOUTH'), validate(applySchema), h(async (req, res) => {
  const jobs = await loadPublishedJobs(), job = jobs.find((j) => j.id === req.params.id);
  if (!job) throw new AppError(404, 'Mission introuvable.');
  // Un jeune ne peut postuler qu'aux missions que sa formule lui affiche (aucun contournement de la limite gratuite).
  const { plan } = await getPlan(req.user.id), rec = recommendationsFor(jobs, await haveMap(req.user.id), plan);
  if (!rec.shown.some((x) => x.job.id === job.id)) throw new AppError(403, 'Cette mission ne fait pas partie de vos recommandations.');
  const app = await prisma.application.create({ data: { jobId: job.id, userId: req.user.id, message: req.body.message } }).catch((e) => { if (e.code === 'P2002') throw new AppError(409, 'Vous avez déjà postulé à cette mission.'); throw e; });
  const co = await prisma.company.findUnique({ where: { id: job.companyId } });
  await notify(co.ownerUserId, 'application', `Nouvelle candidature pour « ${job.title} ».`);
  ok(res, { id: app.id }, 201);
}));
r.patch('/applications/:id/status', ...company, validate(appStatusSchema), h(async (req, res) => {
  const co = await companyOf(req);
  const app = await prisma.application.findFirst({ where: { id: req.params.id, job: { companyId: co.id } }, include: { job: true } });
  if (!app) throw new AppError(404, 'Candidature introuvable.');
  await prisma.application.update({ where: { id: app.id }, data: { status: req.body.status } });
  await notify(app.userId, 'application', `Votre candidature pour « ${app.job.title} » a changé de statut.`);
  await audit(req.user.id, 'application.status', 'application:' + app.id, { status: req.body.status });
  ok(res);
}));
export default r;
