import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { companySchema } from '../schemas/index.js';
import { companyOf } from './jobs.js';
import { loadTalents, talentDto } from '../services/talents.js';
const r = Router();
r.use(['/companies', '/talents'], authenticate(), requireRole('COMPANY')); // limité à ces chemins : ce routeur est monté sur /api
const dto = (c) => ({ id: c.id, name: c.name, sector: c.sector, description: c.description, city: c.city, verification: c.verification });
r.get('/companies/me', h(async (req, res) => ok(res, dto(await companyOf(req)))));
r.put('/companies/me', validate(companySchema), h(async (req, res) => {
  const co = await companyOf(req);
  ok(res, dto(await prisma.company.update({ where: { id: co.id }, data: req.body })));
}));
r.get('/companies/me/overview', h(async (req, res) => {
  const co = await companyOf(req);
  const [jobs, favs, notes, talents] = await Promise.all([
    prisma.job.findMany({ where: { companyId: co.id }, include: { skills: { include: { skill: true } }, applications: true }, orderBy: { createdAt: 'desc' } }),
    prisma.favorite.findMany({ where: { companyId: co.id } }),
    prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 8 }), loadTalents()]);
  const byId = new Map(talents.map((u) => [u.id, u])), jobById = new Map(jobs.map((j) => [j.id, j]));
  const applications = jobs.flatMap((j) => j.applications.map((a) => ({ id: a.id, jobId: j.id, jobTitle: j.title, status: a.status, message: a.message, createdAt: a.createdAt, talent: byId.has(a.userId) ? talentDto(byId.get(a.userId), jobById.get(j.id)) : null })));
  ok(res, { company: dto(co), favorites: favs.map((f) => f.userId),
    jobs: jobs.map((j) => ({ id: j.id, title: j.title, description: j.description, deliverables: j.deliverables, budgetMin: j.budgetMin, budgetMax: j.budgetMax, deadline: j.deadline, mode: j.mode, location: j.location, subtasks: j.subtasks, status: j.status, skills: j.skills.map((s) => s.skill.name), applications: j.applications.length })),
    applications, activity: notes.map((n) => ({ content: n.content, createdAt: n.createdAt })) });
}));
r.post('/companies/me/favorites/:userId', h(async (req, res) => {
  const co = await companyOf(req);
  await prisma.favorite.upsert({ where: { companyId_userId: { companyId: co.id, userId: req.params.userId } }, update: {}, create: { companyId: co.id, userId: req.params.userId } });
  ok(res);
}));
r.delete('/companies/me/favorites/:userId', h(async (req, res) => {
  const co = await companyOf(req);
  await prisma.favorite.deleteMany({ where: { companyId: co.id, userId: req.params.userId } });
  ok(res);
}));
const jobFor = async (req, co) => {
  if (!req.query.jobId) return null;
  const job = await prisma.job.findFirst({ where: { id: String(req.query.jobId), companyId: co.id }, include: { skills: { include: { skill: true } } } });
  if (!job) throw new AppError(404, 'Mission introuvable.');
  return job;
};
r.get('/talents', h(async (req, res) => {
  const co = await companyOf(req), job = await jobFor(req, co), q = String(req.query.q || '').toLowerCase().slice(0, 60), skill = String(req.query.skill || '');
  const favs = new Set((await prisma.favorite.findMany({ where: { companyId: co.id } })).map((f) => f.userId));
  let list = (await loadTalents()).map((u) => talentDto(u, job, favs));
  if (q) list = list.filter((t) => (t.name + ' ' + t.title).toLowerCase().includes(q));
  if (skill) list = list.filter((t) => t.skills.some((s) => s.name === skill));
  if (req.query.relevantOnly === '1' && job) list = list.filter((t) => t.fit.have.length);
  ok(res, list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 50));
}));
r.get('/talents/:id', h(async (req, res) => {
  const co = await companyOf(req), job = await jobFor(req, co);
  const u = (await loadTalents()).find((x) => x.id === req.params.id);
  if (!u) throw new AppError(404, 'Profil introuvable.');
  const favs = new Set((await prisma.favorite.findMany({ where: { companyId: co.id } })).map((f) => f.userId));
  ok(res, talentDto(u, job, favs));
}));
export default r;
