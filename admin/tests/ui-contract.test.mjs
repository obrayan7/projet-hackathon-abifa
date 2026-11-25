// Vérifie que l'administration affiche les réponses RÉELLES de l'API et n'appelle que les routes prévues.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
function makeEnv(api, token = 't0k') {
  const calls = [], handlers = {}, store = token ? { 'skillup-admin-token': token } : {}, app = { innerHTML: '' }, hash = {};
  const el = (v = {}) => ({ value: '', textContent: '', dataset: {}, classList: { toggle() {}, contains: () => true }, setAttribute() {}, ...v });
  const document = { currentScript: { src: 'file:///admin/assets/js/pages.js' }, querySelector: (s) => (s === '#app' ? app : s === '#mot' ? el({ value: 'Motif de test valable' }) : el()), querySelectorAll: () => [], addEventListener: (t, f) => (handlers[t] ??= []).push(f), body: { style: {} } };
  const location = { search: '', href: 'http://admin/', hash: '' };
  const fetch = async (url, o = {}) => { const p = url.replace(/^.*\/api/, ''), body = o.body ? JSON.parse(o.body) : undefined; calls.push({ m: o.method, p, body, auth: o.headers?.Authorization }); const r = api(o.method, p, body);
    return r instanceof Error ? { ok: false, status: r.status || 400, json: async () => ({ success: false, message: r.message }) } : { ok: true, status: 200, json: async () => ({ success: true, data: r }) }; };
  const ctx = vm.createContext({ document, location, fetch, window: { SKILLUP_API: 'https://api.test' }, sessionStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] }, requestAnimationFrame: () => 0, scrollTo() {}, scrollY: 0, URL, URLSearchParams, FormData, console, setTimeout, Promise, Date, JSON, Math, Object, Array, String, Number, Set });
  ctx.window.window = ctx.window;
  ['assets/js/config.js', 'assets/js/core.js', 'assets/js/pages.js'].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  const click = async (data) => { for (const h of handlers.click || []) await h({ target: { closest: () => ({ tagName: 'BUTTON', dataset: data, setAttribute() {} }) } }); };
  return { ctx, app, calls, click, location, store, handlers };
}
const page = (items) => ({ items, total: items.length, page: 1, pages: 1 });
const stats = { users: 12, companies: 4, jobsPublished: 6, proActive: 2, adsLive: 1, signups: [1, 2, 3, 0, 4, 5, 1], roles: { YOUTH: 9, COMPANY: 3 }, jobStatus: { PUBLISHED: 6, IN_REVIEW: 1 }, reports: { done: 1, total: 3 }, alerts: { companiesPending: 1, reportsOpen: 2, appealsOpen: 0, paymentsIssues: 1, adsToReview: 1, submissionsPending: 3 } };
const sub = { id: 's1', user: 'Awa', challengeTitle: 'Affiche', skill: 'Design graphique', kind: 'IMAGE', fileUrl: '/api/files/a.png?exp=1&sig=2', fileName: 'a.png', description: 'Mon affiche', status: 'PENDING', comment: '', createdAt: '2026-11-15T10:00:00Z' };
const ad = { id: 'ad1', advertiserName: 'Atelier Wax', name: 'Collection', title: 'Collection wax', text: 'Texte', destinationUrl: 'https://exemple.bj', mediaRef: null, ctaLabel: 'Voir', status: 'SCHEDULED', startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-12-10T00:00:00Z', frequencyCap: 3, orderRef: 'CMD-1', paymentConfirmed: false, reviewNote: null, placementIds: ['dashboard-jeune'], impressions: 20, clicks: 2, ctr: 10 };
const api = (role = 'ADMIN') => (m, p, b) => {
  if (p === '/admin/me') return { id: 'a1', name: 'Admin', role };
  if (p === '/admin/stats') return stats;
  if (p.startsWith('/admin/audit')) return page([{ id: 'l1', createdAt: '2026-11-15T10:00:00Z', actor: 'a1', action: 'user.suspended', resource: 'user:u1', reason: 'Spam' }]);
  if (p.startsWith('/admin/placements')) return [{ id: 'dashboard-jeune', name: 'Carte du tableau de bord', active: true }];
  if (p.startsWith('/admin/ads/ad1')) return ad;
  if (p.startsWith('/admin/ads')) return page([ad]);
  if (p.startsWith('/admin/submissions')) return page([sub]);
  if (p.startsWith('/admin/users')) return page([{ id: 'u1', name: 'Awa', email: 'a@b.bj', role: 'YOUTH', status: 'ACTIVE', plan: 'FREE', createdAt: '2026-11-01T00:00:00Z' }]);
  if (p.startsWith('/admin/companies')) return page([{ id: 'c1', name: 'Atelier', sector: 'Mode', jobs: 2, status: 'PENDING' }]);
  if (p.startsWith('/admin/jobs')) return page([{ id: 'j1', name: 'Affiches', company: 'Atelier', applications: 1, status: 'IN_REVIEW' }]);
  if (p.startsWith('/admin/challenges')) return page([{ id: 'ch1', name: 'Affiche', skill: 'Design graphique', level: 'Débutant', source: 'AI', status: 'PUBLISHED' }]);
  if (p.startsWith('/admin/evaluations')) return page([{ id: 'e1', name: 'Awa · Affiche', comment: 'À améliorer', appealReason: 'Je conteste', status: 'OPEN' }]);
  if (p.startsWith('/admin/reports')) return page([{ id: 'r1', name: 'JOB j1', type: 'JOB', reason: 'Suspect', resolution: null, status: 'OPEN' }]);
  if (p.startsWith('/admin/payments')) return page([{ id: 'p1', reference: 'SKP-1', user: 'Awa', amount: 1450, currency: 'XOF', provider: 'sandbox', status: 'CONFIRMED', createdAt: '2026-11-02T00:00:00Z' }]);
  return {};
};
const PAGES = ['dashboard', 'utilisateurs', 'entreprises', 'missions', 'defis', 'soumissions', 'evaluations', 'signalements', 'paiements', 'publicites', 'publicite', 'rapports', 'journal', 'parametres'];
test('admin : toutes les pages s\'affichent, avec le jeton Bearer', async () => {
  for (const p of PAGES) {
    const e = makeEnv(api()); e.ctx.window.__id = p === 'publicite' ? 'ad1' : '';
    await vm.runInContext(`Admin.mount('${p}')`, e.ctx);
    assert.ok(e.app.innerHTML.length > 300, p + ' vide'); assert.ok(!/undefined|\[object|NaN/.test(e.app.innerHTML), p + ' contient undefined');
    assert.ok(e.calls.every((c) => c.auth === 'Bearer t0k'), 'toutes les requêtes doivent porter le jeton');
  }
});
test('admin : sans session, redirection vers la connexion ; un modérateur n\'accède pas aux pages réservées', async () => {
  const e = makeEnv(api(), null); await vm.runInContext("Admin.mount('dashboard')", e.ctx); assert.equal(e.location.href, 'index.html'); assert.equal(e.calls.length, 0);
  const m = makeEnv(api('MODERATOR')); await vm.runInContext("Admin.mount('paiements')", m.ctx); assert.equal(m.location.href, 'dashboard.html');
  const m2 = makeEnv(api('MODERATOR')); await vm.runInContext("Admin.mount('dashboard')", m2.ctx); assert.ok(!/Utilisateurs<\/a>/.test(m2.app.innerHTML));
});
test('admin : actions sensibles avec motif obligatoire, validation d\'un livrable, activation d\'une publicité', async () => {
  const e = makeEnv(api());
  await vm.runInContext("Admin.mount('utilisateurs')", e.ctx);
  await e.click({ act: 'ask', k: 'users', id: 'u1', v: 'SUSPENDED', m: '1', l: 'Suspendre' });
  assert.ok(!e.calls.some((c) => c.m === 'PATCH'), 'rien ne part tant que le motif manque');
  assert.match(e.app.innerHTML, /motif obligatoire/);
  await e.click({ act: 'ok' });
  const c = e.calls.find((x) => x.m === 'PATCH'); assert.equal(c.p, '/admin/users/u1/status'); assert.equal(c.body.status, 'SUSPENDED'); assert.ok(c.body.reason.length >= 5);
  const s = makeEnv(api()); await vm.runInContext("Admin.mount('soumissions')", s.ctx);
  assert.match(s.app.innerHTML, /localhost:4000\/api\/files\/a\.png/);
  await s.click({ act: 'ask', k: 'sub', id: 's1', v: 'VALIDATED', m: '0', l: 'Valider' });
  const r = s.calls.find((x) => x.m === 'PATCH'); assert.equal(r.p, '/admin/submissions/s1/review'); assert.equal(r.body.decision, 'VALIDATED');
  const a = makeEnv(api()); await vm.runInContext("Admin.mount('publicites')", a.ctx);
  assert.match(a.app.innerHTML, /Activer/);
  await a.click({ act: 'ask', k: 'ads', id: 'ad1', v: 'activate', m: '1', l: 'Activer' }); await a.click({ act: 'ok' });
  const act = a.calls.find((x) => x.m === 'POST' && x.p === '/admin/ads/ad1/activate'); assert.equal(act.body.confirmPayment, true); assert.ok(act.body.reason.length >= 5);
});
test('admin : connexion stocke le jeton et une erreur reste lisible', async () => {
  let fail = false;
  const e = makeEnv((m, p) => (p === '/admin/auth/login' ? (fail ? Object.assign(new Error('Identifiants incorrects.'), { status: 401 }) : { token: 'jwt-x', user: { id: 'a1', name: 'A', role: 'ADMIN' } }) : {}), null);
  await vm.runInContext('Admin.login()', e.ctx);
  e.ctx.FormData = class { constructor() { return { get: (k) => ({ email: 'a@b.bj', pw: 'secret123' })[k] }; } };
  const submit = async () => { const er = { textContent: '' }; e.ctx.document.querySelector = (s) => (s === '#err' ? er : { value: '' }); for (const h of e.handlers.submit) await h({ target: { closest: (s) => (s === '[data-login]' ? {} : null) }, preventDefault() {} }); return er; };
  await submit(); assert.equal(e.store['skillup-admin-token'], 'jwt-x'); assert.equal(e.location.href, 'dashboard.html');
  fail = true; assert.match((await submit()).textContent, /Identifiants incorrects/);
});
