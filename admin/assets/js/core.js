// Noyau de l'administration : appels API avec jeton Bearer (session distincte de celle des jeunes et des entreprises).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TOKEN = 'skillup-admin-token';
const ORIGIN = (window.SKILLUP_API || '').replace(/\/$/, '');
const API = ORIGIN + '/api';
const A = { me: null };
class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }
async function req(method, path, body) {
  const headers = {}, t = sessionStorage.getItem(TOKEN);
  if (t) headers.Authorization = 'Bearer ' + t;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); } catch (e) { throw new ApiError('Connexion au serveur impossible.', 0); }
  let j = null;
  try { j = await r.json(); } catch (e) { /* corps vide */ }
  if (r.status === 401 && path !== '/admin/auth/login') { sessionStorage.removeItem(TOKEN); location.href = 'index.html'; throw new ApiError('Session expirée.', 401); }
  if (!r.ok || !j || j.success === false) throw new ApiError((j && j.message) || 'Erreur ' + r.status, r.status);
  return j.data;
}
const get = (p) => req('GET', p), post = (p, b) => req('POST', p, b === undefined ? {} : b), patch = (p, b) => req('PATCH', p, b), put = (p, b) => req('PUT', p, b);
