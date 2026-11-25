import { prisma } from '../config/prisma.js';
import { scoreJob, reasons } from './matching.js';
export const loadTalents = () => prisma.user.findMany({ where: { role: 'YOUTH', status: 'ACTIVE', skills: { some: {} } }, include: { youthProfile: true, skills: { include: { skill: true } }, proofs: { include: { skill: true, submission: { include: { challenge: true } } } } }, take: 300 });
export const jobRequired = (job) => job.skills.map((s) => ({ name: s.skill?.name || s.name, importance: s.importance || 1 }));
/** Une entreprise ne voit que les preuves validées que le jeune a choisi de partager. */
export function talentDto(u, job, favs) {
  const have = new Map(u.skills.map((s) => [s.skill.name, s.status])), p = u.youthProfile;
  const shown = p?.shareProofs === false ? [] : u.proofs.filter((x) => x.shared), req = job ? jobRequired(job) : null;
  return { id: u.id, name: u.name, title: p?.title || '', city: p?.city || '', bio: p?.bio || '',
    skills: u.skills.map((s) => ({ name: s.skill.name, status: s.status })),
    proofs: shown.map((x) => ({ title: x.submission.challenge.title, skill: x.skill.name, status: 'VALIDATED' })), hiddenProofs: u.proofs.length - shown.length,
    score: req ? scoreJob(req, have) : null, fit: req ? reasons(req, have) : null, favorite: favs ? favs.has(u.id) : false };
}
