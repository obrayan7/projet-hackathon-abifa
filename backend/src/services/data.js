import { prisma } from '../config/prisma.js';
import { skillStatusFrom } from './passport.js';
import { signedUrl } from '../utils/storage.js';
export async function getPlan(userId) {
  const s = await prisma.subscription.findFirst({ where: { userId, status: 'ACTIVE', endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
  return { plan: s ? 'PRO' : 'FREE', sub: s };
}
export async function loadPublishedJobs() {
  const jobs = await prisma.job.findMany({ where: { status: 'PUBLISHED' }, include: { company: true, skills: { include: { skill: true } } }, orderBy: { createdAt: 'desc' }, take: 300 });
  return jobs.map((j) => ({ ...j, skills: j.skills.map((s) => ({ name: s.skill.name, importance: s.importance })) }));
}
export const haveMap = async (userId) => new Map((await prisma.userSkill.findMany({ where: { userId }, include: { skill: true } })).map((s) => [s.skill.name, s.status]));
export async function ensureSkills(names) {
  const out = [];
  for (const name of names) out.push(await prisma.skill.upsert({ where: { name }, update: {}, create: { name } }));
  return out;
}
/** Recalcule le statut d'une compétence d'après les livrables (déclarée / démontrée / validée). */
export async function recomputeSkill(userId, skillId) {
  const subs = await prisma.submission.findMany({ where: { userId, challenge: { skillId } }, select: { status: true } });
  const status = skillStatusFrom({ validated: subs.some((s) => s.status === 'VALIDATED'), pending: subs.some((s) => s.status === 'PENDING') });
  await prisma.userSkill.updateMany({ where: { userId, skillId }, data: { status } });
}
export const jobDto = (j) => ({ id: j.id, title: j.title, description: j.description, deliverables: j.deliverables, budgetMin: j.budgetMin, budgetMax: j.budgetMax, deadline: j.deadline, mode: j.mode, location: j.location, subtasks: j.subtasks, status: j.status, createdAt: j.createdAt, company: j.company?.name, skills: (j.skills || []).map((s) => s.skill?.name || s.name) });
export const subDto = (s) => ({ id: s.id, challengeId: s.challengeId, challengeTitle: s.challenge?.title, skill: s.challenge?.skill?.name, kind: s.kind, url: s.url, fileName: s.fileName, fileUrl: s.fileKey ? signedUrl(s.fileKey) : null, description: s.description, status: s.status, comment: s.evaluation?.comment || '', evaluationId: s.evaluation?.id || null, createdAt: s.createdAt });
export const chalDto = (c) => ({ id: c.id, title: c.title, skill: c.skill?.name, description: c.description, criteria: c.criteria, duration: c.duration, source: c.source });
