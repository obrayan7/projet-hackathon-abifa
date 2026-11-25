// Vérifie que les écrans jeune et entreprise affichent correctement les réponses RÉELLES de l'API (contrat), sans navigateur.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function makeEnv(api) {
  const calls = [], handlers = {}, app = { innerHTML: '' };
  const el = () => ({ value: '', textContent: '', className: '', checked: true, disabled: false, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => true }, setAttribute() {}, scrollIntoView() {}, remove() {}, innerHTML: '', querySelector: () => el() });
  const document = { currentScript: { src: 'file:///site/assets/js/api.js' }, querySelector: (s) => (s === '#app' ? app : el()), querySelectorAll: () => [], addEventListener: (t, f) => (handlers[t] ??= []).push(f), body: { style: {} } };
  const location = { search: '', href: 'http://x/', hash: '' };
  const fetch = async (url, o = {}) => {
    const p = url.replace(/^.*\/api/, ''), body = o.body && typeof o.body === 'string' ? JSON.parse(o.body) : o.body;
    calls.push([o.method, p, body]);
    const r = api(o.method, p, body);
    if (r instanceof Error) return { ok: false, status: r.status || 400, json: async () => ({ success: false, message: r.message }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: r }) };
  };
  const ctx = vm.createContext({ document, location, fetch, window: { SKILLUP_API: '' }, sessionStorage: { getItem: () => null, setItem() {}, clear() {} }, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, scrollTo() {}, scrollY: 0, URL, URLSearchParams, FormData, Blob, console, setTimeout, Promise, Date, JSON, Set, Math, Object, Array, String, Number, navigator: {}, AbortController });
  ctx.window.window = ctx.window; ctx.window.location = location; ctx.window.document = document;
  const load = (...files) => files.forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  const click = async (data, extra = {}) => { for (const h of handlers.click || []) await h({ target: { closest: () => ({ tagName: 'BUTTON', dataset: data, setAttribute() {} }) }, preventDefault() {}, ...extra }); };
  return { ctx, app, calls, load, click, handlers, location };
}
const overview = (over = {}) => ({ user: { name: 'Awa Koudjo', email: 'a@b.bj', role: 'YOUTH' }, plan: 'FREE', subscription: null,
  profile: { title: 'Graphiste', bio: 'Je conçois des affiches.', city: 'Cotonou', languages: 'Français', availability: '', portfolioUrl: '', shareProofs: true, shareWorks: true },
  skills: [{ name: 'Design graphique', level: 62, status: 'DEMONSTRATED' }],
  challenges: [{ id: 'c1', title: 'Affiche pour un événement local', skill: 'Design graphique', description: 'Créez une affiche.', criteria: ['Lisibilité', 'Couleurs'], duration: '3 h', source: 'AI' }],
  submissions: [{ id: 's1', challengeId: 'c1', challengeTitle: 'Affiche pour un événement local', skill: 'Design graphique', kind: 'IMAGE', url: null, fileName: 'affiche.png', fileUrl: '/api/files/x.png?exp=1&sig=2', description: '', status: 'REVISION', comment: 'Ajoutez la date', evaluationId: 'e1', createdAt: '2026-11-15T10:00:00Z' }],
  recommendations: { total: 2, shown: [{ jobId: 'j1', title: 'Affiches pour un événement', company: 'Studio Nokoué', budgetMin: 40000, budgetMax: 40000, deadline: '5 jours', score: 70, reasons: { have: [{ skill: 'Design graphique', status: 'DEMONSTRATED' }], miss: [] } }] },
  applied: [], ...over });
const AI = { profile: { titre: 'Graphiste', bio: 'Graphiste spécialisé(e) en Design graphique.' }, skills: [{ name: 'Design graphique', level: 62, evidence: 'Mentionné' }], challenges: [{ skill: 'Design graphique', title: 'Affiche pour un événement local', description: 'Créez une affiche.', criteria: ['Lisibilité'], duration: '3 h' }], questions: [], fallback: false };

test('espace jeune : toutes les pages s\'affichent avec les données du serveur', async () => {
  const api = (m, p) => (p === '/auth/me' ? { id: 'u1', name: 'Awa Koudjo', email: 'a@b.bj', role: 'YOUTH' } : p === '/youth/overview' ? overview() : p.startsWith('/ads/eligible') ? { id: 'a1', label: 'Sponsorisé', advertiser: 'Atelier Wax', title: 'Collection', text: 'Texte', ctaLabel: 'Voir' } : {});
  for (const page of ['dashboard', 'competences', 'profil', 'defis', 'portfolio', 'proof-passport', 'recommandations', 'abonnement', 'parametres']) {
    const e = makeEnv(api); e.load('assets/js/api.js', 'assets/js/auth.js', 'assets/js/jeune/pages.js');
    await vm.runInContext(`Jeune.mount('${page}')`, e.ctx);
    assert.ok(e.app.innerHTML.length > 300, page + ' vide');
    assert.ok(!/undefined|\[object/.test(e.app.innerHTML), page + ' contient undefined');
  }
});
test('jeune : analyse IA, confirmation, envoi d\'un lien, candidature, paiement via le serveur', async () => {
  const log = [];
  const api = (m, p, b) => { log.push(m + ' ' + p);
    if (p === '/auth/me') return { id: 'u1', name: 'Awa', email: 'a@b.bj', role: 'YOUTH' };
    if (p === '/youth/overview' || p === '/youth/skills/confirm') return overview();
    if (p === '/ai/skills/discover') return AI;
    if (p === '/subscriptions/checkout') return { reference: 'SKP-1', checkoutUrl: null, sandbox: true };
    if (p.startsWith('/ads/')) return null;
    return {}; };
  const e = makeEnv(api); e.load('assets/js/api.js', 'assets/js/auth.js', 'assets/js/jeune/pages.js');
  await vm.runInContext("Jeune.mount('competences')", e.ctx);
  vm.runInContext("S.say='Je conçois des affiches avec Canva depuis deux ans pour des concerts.'", e.ctx);
  await e.click({ act: 'send' }); await new Promise((r) => setTimeout(r, 30));
  assert.ok(log.includes('POST /ai/skills/discover'));
  assert.match(e.app.innerHTML, /Compétences détectées/); assert.match(e.app.innerHTML, /Design graphique/);
  await e.click({ act: 'ok', v: 'Design graphique' });
  assert.ok(log.includes('POST /youth/skills/confirm'));
  await e.click({ act: 'apply', v: 'j1' }); assert.ok(log.includes('POST /jobs/j1/applications'));
  await e.click({ act: 'rep', v: 'j1' }); assert.ok(log.includes('POST /reports'));
  await vm.runInContext("document.querySelector=(s)=>s==='#terms'?{checked:true}:(s==='#app'?{innerHTML:''}:{value:'',textContent:'',classList:{toggle(){}},setAttribute(){}})", e.ctx);
  await e.click({ act: 'pro' }); assert.ok(log.includes('POST /subscriptions/checkout'));
  assert.ok(!log.some((x) => /subscriptions\/activate|PUT \/subscriptions/.test(x)), 'le navigateur ne doit jamais activer PRO');
});
test('erreur serveur : message lisible, pas de plantage', async () => {
  const api = (m, p) => (p === '/auth/me' ? { id: 'u1', name: 'Awa', email: 'a@b.bj', role: 'YOUTH' } : p === '/youth/overview' ? Object.assign(new Error('Le service est indisponible.'), { status: 503 }) : {});
  const e = makeEnv(api); e.load('assets/js/api.js', 'assets/js/auth.js', 'assets/js/jeune/pages.js');
  await vm.runInContext("Jeune.mount('dashboard')", e.ctx);
  assert.match(e.app.innerHTML, /Le service est indisponible/);
});

const tal = (id, name, score) => ({ id, name, title: 'Graphiste', city: 'Cotonou', bio: '', skills: [{ name: 'Design graphique', status: 'VALIDATED' }], proofs: [{ title: 'Affiche', skill: 'Design graphique', status: 'VALIDATED' }], hiddenProofs: 1, score, fit: { have: [{ skill: 'Design graphique', status: 'VALIDATED' }], miss: [] }, favorite: false });
const co = () => ({ company: { id: 'co1', name: 'Atelier Wax', sector: 'Mode', description: 'x', city: 'Cotonou', verification: 'VERIFIED' }, favorites: [],
  jobs: [{ id: 'j1', title: 'Affiches', description: 'Affiches pour un événement local', deliverables: '3 affiches', budgetMin: 30000, budgetMax: 45000, deadline: '5 jours', mode: 'À distance', location: '', subtasks: [], status: 'PUBLISHED', skills: ['Design graphique'], applications: 1 }],
  applications: [{ id: 'a1', jobId: 'j1', jobTitle: 'Affiches', status: 'NEW', message: 'Bonjour', createdAt: '2026-11-15T10:00:00Z', talent: tal('t1', 'Marie Agbodan', 100) }], activity: [{ content: 'Nouvelle candidature', createdAt: '2026-11-15T10:00:00Z' }] });
test('espace entreprise : pages, scores serveur, preuves partagées seulement, actions', async () => {
  const log = [];
  const api = (m, p, b) => { log.push([m, p, b]);
    if (p === '/auth/me') return { id: 'u2', name: 'Boutique', email: 'c@d.bj', role: 'COMPANY' };
    if (p === '/companies/me/overview') return co();
    if (p === '/skills') return [{ name: 'Design graphique' }, { name: 'Excel' }];
    if (p.startsWith('/talents/')) return tal('t1', 'Marie Agbodan', 100);
    if (p.startsWith('/talents')) return [tal('t1', 'Marie Agbodan', 100), tal('t2', 'Koffi', 60)];
    if (p === '/ai/jobs/decompose') return { subtasks: ['Maquette', 'Livraison'], fallback: false };
    return {}; };
  for (const page of ['dashboard', 'talents', 'missions', 'publier-mission', 'candidats', 'candidat', 'profil', 'parametres']) {
    const e = makeEnv(api); e.load('assets/js/api.js', 'assets/js/auth.js', 'assets/js/entreprise/data.js', 'assets/js/entreprise/pages.js');
    e.ctx.window.__id = page === 'candidat' ? 't1' : '';
    await vm.runInContext(`Ent.mount('${page}')`, e.ctx);
    assert.ok(e.app.innerHTML.length > 300, page + ' vide');
    assert.ok(!/undefined|\[object|NaN/.test(e.app.innerHTML), page + ' contient undefined/NaN');
    if (page === 'candidat') { assert.match(e.app.innerHTML, /100 %/); assert.match(e.app.innerHTML, /1 preuve\(s\) non partagée\(s\)/); }
  }
  const e = makeEnv(api); e.load('assets/js/api.js', 'assets/js/auth.js', 'assets/js/entreprise/data.js', 'assets/js/entreprise/pages.js');
  await vm.runInContext("Ent.mount('candidats')", e.ctx);
  await e.click({ act: 'st', a: 'a1', v: 'Acceptée' });
  assert.ok(log.some(([m, p, b]) => m === 'PATCH' && p === '/applications/a1/status' && b.status === 'ACCEPTED'));
  await e.click({ act: 'jt', v: 'j1' });
  assert.ok(log.some(([m, p, b]) => m === 'PATCH' && p === '/jobs/j1/status' && b.status === 'CLOSED'));
});

test('jeune : envoi d\'un fichier en dépôt direct (Supabase) : URL signée, PUT du fichier, puis finalisation', async () => {
  const calls = [];
  const api = (m, p, b) => { calls.push([m, p, b]);
    if (p === '/auth/me') return { id: 'u1', name: 'Awa', email: 'a@b.bj', role: 'YOUTH' };
    if (p === '/youth/overview') return overview({ submissions: [] });
    if (p === '/config') return { uploadMode: 'direct' };
    if (p === '/submissions/upload-url') return { key: 'k.png', uploadUrl: 'https://p.supabase.co/storage/v1/object/upload/sign/s/k.png?token=T', ticket: 'tk', contentType: 'image/png' };
    return {}; };
  const e = makeEnv(api); e.load('assets/js/api.js', 'assets/js/auth.js', 'assets/js/jeune/pages.js');
  e.ctx.FormData = class { constructor(f) { this.m = new Map(Object.entries((f && f.__vals) || {})); } get(k) { return this.m.get(k); } append(k, v) { this.m.set(k, v); } };
  const puts = []; const base = e.ctx.fetch; e.ctx.fetch = async (u, o = {}) => { if (u.startsWith('https://p.supabase.co')) { puts.push([o.method, u, o.headers, o.body]); return { ok: true, status: 200, json: async () => ({}) }; } return base(u, o); };
  await vm.runInContext("Jeune.mount('defis')", e.ctx);
  await e.click({ act: 'open', v: 'c1' });
  const file = { size: 1000, type: 'image/png', name: 'affiche.png' };
  for (const h of e.handlers.submit) await h({ target: { closest: (s) => (s === '[data-sub]' ? { __vals: { d: 'Mon affiche', f: file } } : null) }, preventDefault() {} });
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(puts.length, 1); assert.equal(puts[0][0], 'PUT'); assert.equal(puts[0][3], file);
  const order = calls.map((c) => c[1]).filter((p) => p.startsWith('/submissions'));
  assert.deepEqual(order, ['/submissions/upload-url', '/submissions']);
  const fin = calls.find((c) => c[1] === '/submissions'); assert.equal(fin[2].fileKey, 'k.png'); assert.equal(fin[2].ticket, 'tk'); assert.equal(fin[2].kind, 'IMAGE');
});
