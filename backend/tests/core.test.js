import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreJob, visibleCount, rankJobsForUser, recommendationsFor } from '../src/services/matching.js';
import { checkTransition, isServable, ctr } from '../src/services/adsRules.js';
import { applyPaymentEvent, sign, verifySignature } from '../src/services/paymentCore.js';
import { sniff, checkFile } from '../src/utils/fileSniff.js';
import { safeHttpsUrl } from '../src/utils/urls.js';
import { skillStatusFrom } from '../src/services/passport.js';
import { supabaseStorage } from '../src/services/supabaseStorage.js';
import { makeTicket, checkTicket } from '../src/services/uploadTicket.js';
import { MIME_EXT, kindOfMime } from '../src/utils/fileSniff.js';

const job = (id, names) => ({ id, createdAt: '2026-11-01', skills: names.map((name) => ({ name, importance: 1 })) });
const have = new Map([['Design graphique', 'DECLARED'], ['Photographie', 'VALIDATED']]);

test('matching : pondération par statut, identique pour tous', () => {
  assert.equal(scoreJob(job(1, ['Design graphique']).skills, have), 30);
  assert.equal(scoreJob(job(1, ['Photographie']).skills, have), 100);
  assert.equal(scoreJob(job(1, ['Design graphique', 'Photographie']).skills, have), 65);
});
test('quota gratuit 50 % (arrondi bas, min 1) et PRO 100 %', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((n) => visibleCount('FREE', n)), [0, 1, 1, 1, 2, 2]);
  assert.deepEqual([0, 1, 3, 5].map((n) => visibleCount('PRO', n)), [0, 1, 3, 5]);
});
test('au plus 5 missions classées, aucune mission inventée, le plan ne change pas le score', () => {
  const jobs = Array.from({ length: 9 }, (_, i) => job('j' + i, ['Photographie']));
  jobs.push(job('x', ['Python']));
  const free = recommendationsFor(jobs, have, 'FREE'), pro = recommendationsFor(jobs, have, 'PRO');
  assert.equal(free.total, 5); assert.equal(free.shown.length, 2); assert.equal(pro.shown.length, 5);
  assert.deepEqual(free.shown.map((x) => x.score), pro.shown.slice(0, 2).map((x) => x.score));
  assert.equal(recommendationsFor([job('x', ['Python'])], have, 'PRO').total, 0);
  assert.equal(rankJobsForUser([], have).length, 0);
});
test('publicités : workflow, activation conditionnée, diffusion uniquement ACTIVE dans la période', () => {
  const now = new Date('2026-11-15');
  const c = { status: 'APPROVED', startsAt: '2026-11-10', endsAt: '2026-12-10', orderRef: 'CMD-1', paymentConfirmedById: 'a1', placementIds: ['dashboard-jeune'] };
  assert.match(checkTransition(c, 'ACTIVE', now), /interdite/);
  assert.equal(checkTransition({ ...c, status: 'SCHEDULED' }, 'ACTIVE', now), null);
  assert.match(checkTransition({ ...c, status: 'SCHEDULED', orderRef: null }, 'ACTIVE', now), /référence/);
  assert.match(checkTransition({ ...c, status: 'SCHEDULED', endsAt: '2026-11-01' }, 'ACTIVE', now), /période/);
  assert.equal(isServable({ ...c, status: 'ACTIVE' }, 'dashboard-jeune', now), true);
  assert.equal(isServable({ ...c, status: 'PAUSED' }, 'dashboard-jeune', now), false);
  assert.equal(isServable({ ...c, status: 'ACTIVE' }, 'fil-accueil', now), false);
  assert.equal(isServable({ ...c, status: 'ACTIVE', startsAt: '2026-12-01' }, 'dashboard-jeune', now), false);
  assert.equal(ctr(200, 9), 4.5); assert.equal(ctr(0, 0), 0);
});
test('URL : https seulement, sans schéma dangereux ni hôte privé', () => {
  assert.ok(safeHttpsUrl('https://exemple.bj/page?a=1'));
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://exemple.bj', 'https://user:pw@exemple.bj', 'https://localhost/x', 'https://192.168.1.4', 'pas une url'])
    assert.equal(safeHttpsUrl(bad), null, bad);
});
test('fichiers : type réel détecté d\'après les octets, pas le nom', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(sniff(png).group, 'image');
  assert.ok(checkFile('IMAGE', png).type);
  assert.match(checkFile('VIDEO', png).error, /ne correspond pas/);
  assert.equal(sniff(Buffer.from('MZ fichier exécutable déguisé')), null);
  assert.match(checkFile('IMAGE', Buffer.concat([png, Buffer.alloc(6 * 1048576)])).error, /trop lourd/);
});
test('passeport : déclaré -> démontré -> validé', () => {
  assert.equal(skillStatusFrom({ validated: false, pending: false }), 'DECLARED');
  assert.equal(skillStatusFrom({ validated: false, pending: true }), 'DEMONSTRATED');
  assert.equal(skillStatusFrom({ validated: true, pending: true }), 'VALIDATED');
});

function fakeTx() {
  const db = { events: [], payments: [{ id: 'p1', userId: 'u1', subscriptionId: 's1', provider: 'sandbox', reference: 'SKP-1', amount: 1450, currency: 'XOF', status: 'PENDING' }], subs: [{ id: 's1', userId: 'u1', status: 'PENDING', startsAt: null, endsAt: null }] };
  return { db, webhookEvent: { create: async ({ data }) => { if (db.events.some((e) => e.provider === data.provider && e.eventId === data.eventId)) { const e = new Error('dup'); e.code = 'P2002'; throw e; } db.events.push(data); } },
    payment: { findUnique: async ({ where }) => db.payments.find((p) => p.reference === where.reference) || null, update: async ({ where, data }) => Object.assign(db.payments.find((p) => p.id === where.id), data) },
    subscription: { findFirst: async () => db.subs.find((s) => s.userId === 'u1' && s.status === 'ACTIVE' && s.endsAt > new Date()) || null, update: async ({ where, data }) => Object.assign(db.subs.find((s) => s.id === where.id), data) } };
}
const evt = (o = {}) => ({ provider: 'sandbox', eventId: 'e1', reference: 'SKP-1', amount: 1450, currency: 'XOF', status: 'SUCCESS', ...o });
test('webhook : signature HMAC vérifiée', () => {
  const raw = '{"a":1}', sig = sign(raw, 'secret');
  assert.equal(verifySignature(raw, sig, 'secret'), true);
  assert.equal(verifySignature(raw, sig, 'autre'), false);
  assert.equal(verifySignature(raw + ' ', sig, 'secret'), false);
  assert.equal(verifySignature(raw, '', 'secret'), false);
  assert.equal(verifySignature(raw, 'zz', 'secret'), false);
});
test('paiement confirmé : PRO activé UNE seule fois, même si le webhook est rejoué', async () => {
  const tx = fakeTx();
  assert.equal((await applyPaymentEvent(tx, evt(), { days: 30 })).activated, true);
  assert.equal(tx.db.subs[0].status, 'ACTIVE');
  const fin = +tx.db.subs[0].endsAt;
  assert.equal((await applyPaymentEvent(tx, evt(), { days: 30 })).duplicate, true);
  assert.equal((await applyPaymentEvent(tx, evt({ eventId: 'e2' }), { days: 30 })).duplicate, true);
  assert.equal(+tx.db.subs[0].endsAt, fin);
});
test('paiement refusé, montant incorrect ou commande inconnue : PRO jamais activé', async () => {
  let tx = fakeTx();
  assert.equal((await applyPaymentEvent(tx, evt({ status: 'FAILED' }), { days: 30 })).failed, true);
  assert.equal(tx.db.subs[0].status, 'PENDING');
  tx = fakeTx();
  assert.match((await applyPaymentEvent(tx, evt({ amount: 1 }), { days: 30 })).rejected, /montant/);
  assert.equal(tx.db.subs[0].status, 'PENDING');
  tx = fakeTx();
  assert.match((await applyPaymentEvent(tx, evt({ reference: 'inconnue' }), { days: 30 })).rejected, /inconnue/);
  assert.equal(tx.db.subs[0].status, 'PENDING');
});

test('dépôt direct : taille réelle contrôlée sans télécharger le fichier, type MIME classé', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.ok(checkFile('IMAGE', png, 1000).type);
  assert.match(checkFile('IMAGE', png, 6 * 1048576).error, /trop lourd/);
  assert.equal(kindOfMime('image/png'), 'IMAGE'); assert.equal(kindOfMime('video/mp4'), 'VIDEO'); assert.equal(kindOfMime('application/pdf'), 'DOCUMENT');
  assert.equal(kindOfMime('text/html'), null); assert.equal(kindOfMime('application/x-msdownload'), null); assert.ok(MIME_EXT['application/pdf']);
});
test('ticket de dépôt : lié à l\'utilisateur et à la clé', () => {
  const t = makeTicket('secret', 'u1', 'k.png');
  assert.equal(checkTicket('secret', 'u1', 'k.png', t), true);
  assert.equal(checkTicket('secret', 'u2', 'k.png', t), false);
  assert.equal(checkTicket('secret', 'u1', 'autre.png', t), false);
  assert.equal(checkTicket('secret', 'u1', 'k.png', ''), false);
});
test('Supabase Storage : requêtes REST (signature de dépôt, inspection par Range, lecture signée, suppression)', async () => {
  const calls = [];
  const fetchImpl = async (u, o = {}) => { calls.push([o.method || 'GET', u, o.headers, o.body]);
    if (u.includes('/object/upload/sign/')) return { ok: true, json: async () => ({ url: '/object/upload/sign/sub/a.png?token=T1' }) };
    if (u.includes('/object/sign/')) return { ok: true, json: async () => ({ signedURL: '/object/sign/sub/a.png?token=T2' }) };
    if (o.method === 'DELETE') return { ok: true };
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3]);
    let read = false;
    return { ok: true, status: 206, headers: { get: (h) => (h === 'content-range' ? 'bytes 0-31/123456' : null) }, body: { getReader: () => ({ read: async () => (read ? { done: true } : ((read = true), { done: false, value: data })), cancel: async () => {} }) } }; };
  const s = supabaseStorage({ url: 'https://p.supabase.co/', key: 'SRV', bucket: 'sub', fetchImpl });
  assert.equal(await s.uploadTarget('a.png'), 'https://p.supabase.co/storage/v1/object/upload/sign/sub/a.png?token=T1');
  const i = await s.inspect('a.png'); assert.equal(i.size, 123456); assert.equal(sniff(i.head).group, 'image');
  assert.equal(await s.downloadUrl('a.png', 600), 'https://p.supabase.co/storage/v1/object/sign/sub/a.png?token=T2');
  assert.match(await s.downloadUrl('a.pdf', 600, 'a.pdf'), /&download=a\.pdf$/);
  await s.remove('a.png');
  assert.ok(calls.every((c) => c[2].Authorization === 'Bearer SRV'), 'la clé de service reste côté serveur et signe chaque appel');
  assert.equal(calls.find((c) => c[2].Range).at(2).Range, 'bytes=0-31');
  assert.equal(calls.at(-1)[0], 'DELETE');
});
