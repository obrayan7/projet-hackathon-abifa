// Moteur de matching : mêmes critères pour tous. Le plan n'influence JAMAIS le score, seulement le nombre affiché.
export const WEIGHT = { DECLARED: 0.3, DEMONSTRATED: 0.7, VALIDATED: 1 };
export const MAX_RECOMMENDATIONS = 5;
export const RULES_VERSION = 'v1';

/** required: [{name, importance}], have: Map<nomCompétence, statut> */
export function scoreJob(required, have) {
  const total = required.reduce((a, r) => a + (r.importance || 1), 0) || 1;
  const sum = required.reduce((a, r) => a + (WEIGHT[have.get(r.name)] || 0) * (r.importance || 1), 0);
  return Math.round((sum / total) * 100);
}
export function reasons(required, have) {
  return {
    have: required.filter((r) => have.has(r.name)).map((r) => ({ skill: r.name, status: have.get(r.name) })),
    miss: required.filter((r) => !have.has(r.name)).map((r) => r.name),
  };
}
/** Visibles : gratuit = 50 % (arrondi inférieur, au moins 1), PRO = 100 %. */
export function visibleCount(plan, n) {
  if (!n) return 0;
  return plan === 'PRO' ? n : Math.max(1, Math.floor(n / 2));
}
/** Classe les missions réellement pertinentes (au moins une compétence commune), 5 au maximum. */
export function rankJobsForUser(jobs, have, max = MAX_RECOMMENDATIONS) {
  return jobs
    .map((j) => ({ job: j, score: scoreJob(j.skills, have), why: reasons(j.skills, have) }))
    .filter((x) => x.why.have.length > 0)
    .sort((a, b) => b.score - a.score || new Date(b.job.createdAt) - new Date(a.job.createdAt) || (a.job.id < b.job.id ? -1 : 1))
    .slice(0, max);
}
export function recommendationsFor(jobs, have, plan) {
  const ranked = rankJobsForUser(jobs, have);
  return { total: ranked.length, shown: ranked.slice(0, visibleCount(plan, ranked.length)) };
}
