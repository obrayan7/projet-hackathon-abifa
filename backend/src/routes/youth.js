import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { h, ok, AppError } from '../utils/http.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { profileSchema, prefsSchema, confirmSkillsSchema } from '../schemas/index.js';
import { getPlan, loadPublishedJobs, ensureSkills, subDto, chalDto } from '../services/data.js';
import { recommendationsFor } from '../services/matching.js';
import { safeHttpsUrl } from '../utils/urls.js';
const r = Router();
r.use(authenticate(), requireRole('YOUTH'));
export const recDto = (x) => ({ jobId: x.job.id, title: x.job.title, company: x.job.company?.name, budgetMin: x.job.budgetMin, budgetMax: x.job.budgetMax, deadline: x.job.deadline, score: x.score, reasons: x.why });
export async function overview(user) {
  const [profile, uskills, subs, jobs, { plan, sub }, apps] = await Promise.all([
    prisma.youthProfile.findUnique({ where: { userId: user.id } }),
    prisma.userSkill.findMany({ where: { userId: user.id }, include: { skill: true }, orderBy: { updatedAt: 'asc' } }),
    prisma.submission.findMany({ where: { userId: user.id }, include: { challenge: { include: { skill: true } }, evaluation: true }, orderBy: { createdAt: 'desc' } }),
    loadPublishedJobs(), getPlan(user.id), prisma.application.findMany({ where: { userId: user.id }, select: { jobId: true } })]);
  const skillIds = uskills.map((s) => s.skillId);
  const challenges = skillIds.length ? await prisma.challenge.findMany({ where: { status: 'PUBLISHED', skillId: { in: skillIds }, OR: [{ ownerUserId: null }, { ownerUserId: user.id }] }, include: { skill: true }, orderBy: { createdAt: 'asc' } }) : [];
  const rec = recommendationsFor(jobs, new Map(uskills.map((s) => [s.skill.name, s.status])), plan);
  return { user: { name: user.name, email: user.email, role: user.role }, plan, subscription: sub ? { endsAt: sub.endsAt } : null,
    profile: { title: profile?.title || '', bio: profile?.bio || '', city: profile?.city || '', languages: profile?.languages || '', availability: profile?.availability || '', portfolioUrl: profile?.portfolioUrl || '', shareProofs: profile?.shareProofs ?? true, shareWorks: profile?.shareWorks ?? true },
    skills: uskills.map((s) => ({ name: s.skill.name, level: s.level, status: s.status })), challenges: challenges.map(chalDto), submissions: subs.map(subDto),
    recommendations: { total: rec.total, shown: rec.shown.map(recDto) }, applied: apps.map((a) => a.jobId) };
}
r.get('/overview', h(async (req, res) => ok(res, await overview(req.user))));
r.get('/profile', h(async (req, res) => ok(res, (await overview(req.user)).profile)));
r.put('/profile', validate(profileSchema), h(async (req, res) => {
  const d = req.body;
  if (d.portfolioUrl && !safeHttpsUrl(d.portfolioUrl)) throw new AppError(400, 'Le lien du portfolio doit commencer par https://');
  await prisma.youthProfile.upsert({ where: { userId: req.user.id }, update: d, create: { userId: req.user.id, ...d } });
  ok(res);
}));
r.put('/preferences', validate(prefsSchema), h(async (req, res) => {
  await prisma.youthProfile.upsert({ where: { userId: req.user.id }, update: req.body, create: { userId: req.user.id, ...req.body } });
  ok(res);
}));
// Les compétences proposées par l'IA sont enregistrées comme DÉCLARÉES, à partir de la dernière analyse conservée côté serveur.
r.post('/skills/confirm', validate(confirmSkillsSchema), h(async (req, res) => {
  const prop = await prisma.aiProposal.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  const wanted = (prop?.payload?.skills || []).filter((s) => req.body.names.includes(s.name));
  if (!wanted.length) throw new AppError(400, 'Aucune compétence correspondante dans votre dernière analyse.');
  const skills = await ensureSkills(wanted.map((s) => s.name));
  for (const w of wanted) {
    const skill = skills.find((s) => s.name === w.name);
    await prisma.userSkill.upsert({ where: { userId_skillId: { userId: req.user.id, skillId: skill.id } }, update: {}, create: { userId: req.user.id, skillId: skill.id, level: Math.round(w.level), status: 'DECLARED', source: 'AI' } });
    for (const c of (prop.payload.challenges || []).filter((c) => c.skill === w.name)) {
      const exists = await prisma.challenge.findFirst({ where: { ownerUserId: req.user.id, skillId: skill.id, title: c.title } });
      if (!exists) await prisma.challenge.create({ data: { title: c.title, description: c.description, criteria: c.criteria, duration: c.duration || '', skillId: skill.id, source: 'AI', status: 'PUBLISHED', ownerUserId: req.user.id } });
    }
  }
  ok(res, await overview(req.user));
}));
r.delete('/skills/:name', h(async (req, res) => {
  const skill = await prisma.skill.findUnique({ where: { name: req.params.name } });
  if (!skill) throw new AppError(404, 'Compétence introuvable.');
  await prisma.userSkill.deleteMany({ where: { userId: req.user.id, skillId: skill.id } });
  await prisma.challenge.deleteMany({ where: { ownerUserId: req.user.id, skillId: skill.id, submissions: { none: {} } } });
  ok(res);
}));
export default r;
