/* Couche d'accès à l'API (mode réel). Le backend est l'autorité : droits, scores, quotas gratuit/PRO, paiement.
   Aucune donnée métier n'est stockée dans le navigateur (seulement un brouillon de texte, le temps de la session). */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOGO = new URL('../images/logo.png', document.currentScript.src).href;
const LOGIN = new URL('../../login.html', document.currentScript.src).href;
const ORIGIN = (window.SKILLUP_API || '').replace(/\/$/, '');
const API = ORIGIN + '/api';
const L = { declare: ['Déclaré', 'b-decl'], demontre: ['Démontré', 'b-demo'], valide: ['Validé', 'b-val'] };
const bd = (s) => `<span class="badge ${L[s][1]}">${L[s][0]}</span>`;
const okUrl = (u) => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };
const SKST = { DECLARED: 'declare', DEMONSTRATED: 'demontre', VALIDATED: 'valide' };
class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }
async function req(method, path, body) {
  const o = { method, credentials: 'include', headers: {} };
  if (body instanceof FormData) o.body = body;
  else if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  let r;
  try { r = await fetch(API + path, o); } catch (e) { throw new ApiError('Connexion au serveur impossible. Vérifiez votre connexion internet.', 0); }
  let j = null;
  try { j = await r.json(); } catch (e) { /* corps vide */ }
  if (r.status === 401 && !path.startsWith('/auth/')) { location.href = LOGIN; throw new ApiError('Session expirée.', 401); }
  if (!r.ok || !j || j.success === false) throw new ApiError((j && j.message) || 'Erreur ' + r.status, r.status);
  return j.data;
}
const get = (p) => req('GET', p), post = (p, b) => req('POST', p, b === undefined ? {} : b), put = (p, b) => req('PUT', p, b), patch = (p, b) => req('PATCH', p, b), del = (p) => req('DELETE', p);
const S = { user: null, plan: 'GRATUIT', endsAt: null, profile: { titre: '', bio: '', ville: '', langues: '', dispo: '', portfolio: '' }, share: { p: 1, w: 1 }, skills: [], chal: [], subs: [], recs: { total: 0, shown: [] }, applied: new Set(), rp: {}, res: null, say: '', said: 0, flt: '', openC: null, sub: { t: 'image', d: '' }, busy: false, up: 0 };
try { S.res = JSON.parse(sessionStorage.getItem('sk-res')); S.say = sessionStorage.getItem('sk-say') || ''; } catch (e) { /* brouillon facultatif */ }
const save = () => { try { sessionStorage.setItem('sk-res', JSON.stringify(S.res)); sessionStorage.setItem('sk-say', S.say || ''); } catch (e) { /* ignoré */ } };
const KIND = { IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document', LINK: 'lien' };
const SUBST = { PENDING: 'En attente', VALIDATED: 'Validé', REVISION: 'À revoir' };
const money = (n) => Number(n || 0).toLocaleString('fr-FR');
function hydrate(o) {
  S.user = { ...(S.user || {}), name: o.user.name, role: 'jeune' };
  S.plan = o.plan === 'PRO' ? 'PRO' : 'GRATUIT'; S.endsAt = o.subscription ? o.subscription.endsAt : null;
  const p = o.profile;
  S.profile = { titre: p.title, bio: p.bio, ville: p.city, langues: p.languages, dispo: p.availability, portfolio: p.portfolioUrl };
  S.share = { p: p.shareProofs ? 1 : 0, w: p.shareWorks ? 1 : 0 };
  S.skills = o.skills.map((s) => ({ n: s.name, l: s.level, st: SKST[s.status] }));
  S.chal = o.challenges.map((c) => ({ id: c.id, skill: c.skill, t: c.title, desc: c.description, crit: c.criteria, dur: c.duration }));
  S.subs = o.submissions.map((s) => ({ id: s.id, chal: s.challengeId, skill: s.skill, ct: s.challengeTitle, type: KIND[s.kind], name: s.fileName || s.url || '', url: s.url, thumb: s.kind === 'IMAGE' && s.fileUrl ? ORIGIN + s.fileUrl : '', desc: s.description, date: new Date(s.createdAt).toLocaleDateString('fr-FR'), st: SUBST[s.status], comment: s.comment }));
  S.recs = { total: o.recommendations.total, shown: o.recommendations.shown.map((x) => ({ id: x.jobId, t: x.title, c: x.company, b: x.budgetMin || x.budgetMax ? `${money(x.budgetMin)} à ${money(x.budgetMax)} FCFA` : 'Budget à discuter', d: x.deadline || '—', m: x.reasons.have.map((h) => ({ n: h.skill })), sc: x.score })) };
  S.applied = new Set(o.applied);
  S.said = S.said || (S.skills.length || S.res ? 1 : 0);
}
const refresh = async () => hydrate(await get('/youth/overview'));
const first = () => (S.user?.name || '').split(' ')[0];
const skillSt = (n) => (S.skills.find((s) => s.n === n) || {}).st || 'declare';
const WT = { valide: 1, demontre: 0.7, declare: 0.3 };
const trust = () => Math.round(S.skills.reduce((a, s) => a + WT[s.st], 0) / Math.max(1, S.skills.length) * 100); // indicatif (le score de matching est calculé par le serveur)
const rec = () => ({ all: { length: S.recs.total }, shown: S.recs.shown });
