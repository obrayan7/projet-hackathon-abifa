// Données de l'espace entreprise : tout vient de l'API (le serveur calcule les scores et masque les preuves non partagées).
let SK = [];
let TAL = [];
const JST = { PUBLISHED: 'Publiée', CLOSED: 'Clôturée', IN_REVIEW: 'En revue', SUSPENDED: 'Suspendue' };
const AST = { NEW: 'Nouvelle', SHORTLISTED: 'Présélectionnée', ACCEPTED: 'Acceptée', REJECTED: 'Refusée' };
const tal = (t) => t && ({ id: t.id, name: t.name, titre: t.title, ville: t.city, bio: t.bio, skills: t.skills.map((s) => [s.name, SKST[s.status]]), proofs: t.proofs.map((p) => [p.title, 'valide', 1]), hidden: t.hiddenProofs, score: t.score, fit: t.fit && { have: t.fit.have.map((h) => [h.skill, SKST[h.status]]), miss: t.fit.miss }, favorite: t.favorite });
S.co = { name: '', secteur: '', ville: '', desc: '', verif: '', jobs: [], apps: [], fav: [], log: [], sel: '' };
async function loadCompany() {
  const o = await get('/companies/me/overview'), c = o.company;
  S.co.id = c.id; S.co.name = c.name; S.co.secteur = c.sector; S.co.ville = c.city; S.co.desc = c.description;
  S.co.verif = { PENDING: 'En attente de vérification', VERIFIED: 'Vérifiée', REJECTED: 'Refusée', SUSPENDED: 'Suspendue' }[c.verification];
  S.co.fav = o.favorites;
  S.co.jobs = o.jobs.map((j) => ({ id: j.id, t: j.title, desc: j.description, k: j.skills, liv: j.deliverables, bmin: j.budgetMin, bmax: j.budgetMax, delai: j.deadline, mode: j.mode, loc: j.location, st: JST[j.status], sub: j.subtasks, nb: j.applications }));
  S.co.apps = o.applications.filter((a) => a.talent).map((a) => ({ id: a.id, job: a.jobId, tal: a.talent.id, st: AST[a.status], msg: a.message, t: tal(a.talent) }));
  S.co.log = o.activity.map((a) => new Date(a.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + a.content);
}
async function loadSkills() { SK = (await get('/skills')).map((s) => s.name); }
async function loadTalents(jobId) { TAL = (await get('/talents' + (jobId ? '?jobId=' + encodeURIComponent(jobId) : ''))).map(tal); }
async function loadTalent(id, jobId) { const t = tal(await get('/talents/' + encodeURIComponent(id) + (jobId ? '?jobId=' + encodeURIComponent(jobId) : ''))); TAL = t ? [t] : []; }
const score = (t) => (t && t.score) || 0;
const fit = (t) => t.fit;
const fmt = (n) => (n ? Number(n).toLocaleString('fr-FR') + ' FCFA' : '—');
const ini = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);
