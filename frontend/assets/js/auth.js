const authH = (t) => `<h1 class="text-2xl font-extrabold text-[var(--navy)]">${t}</h1>`;
const authForm = (reg) => `<main class="min-h-screen grid place-items-center p-4 bg-[var(--mist)]"><form data-form="${reg ? 'reg' : 'log'}" class="card w-full max-w-md space-y-4" novalidate>
<a href="index.html" class="inline-block bg-white rounded-xl px-2 py-1"><img src="${LOGO}" alt="SkillUp IA" class="h-8"></a>${authH(reg ? 'Créer mon compte' : 'Connexion')}
${reg ? '<label class="block text-sm font-semibold">Nom affiché<input name="nom" class="inp" autocomplete="name"></label>' : ''}
<label class="block text-sm font-semibold">E-mail<input name="email" type="email" class="inp" autocomplete="email"></label>
<label class="block text-sm font-semibold">Mot de passe<input name="pw" type="password" class="inp" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
${reg ? '<fieldset class="text-sm font-semibold">Je suis<div class="flex gap-5 mt-1 font-normal"><label><input type="radio" name="role" value="jeune" checked> Jeune / freelance</label><label><input type="radio" name="role" value="entreprise"> Entreprise</label></div></fieldset>' : ''}
<p id="err" role="alert" class="text-sm text-red-600"></p><button class="btn btn-p w-full justify-center">${reg ? 'Créer mon compte' : 'Se connecter'}</button>
<p class="text-sm text-center">${reg ? 'Déjà inscrit ? <a class="font-bold text-[var(--violet)]" href="login.html">Connexion</a>' : 'Pas de compte ? <a class="font-bold text-[var(--violet)]" href="register.html">Créer mon compte</a>'}</p></form></main>`;
const ROLE = { YOUTH: 'jeune', COMPANY: 'entreprise' };
/** Vérifie la session auprès du serveur (jamais le rôle stocké dans le navigateur). */
async function requireUser(role) {
  try {
    const u = await get('/auth/me');
    S.user = { name: u.name, role: ROLE[u.role] };
    if (role && S.user.role !== role) { location.href = LOGIN; return false; }
    return true;
  } catch (e) { location.href = LOGIN; return false; }
}
async function logout() { try { await post('/auth/logout'); } catch (e) { /* session déjà fermée */ } sessionStorage.clear(); location.href = LOGIN.replace('login.html', 'index.html'); }
function initAuth() {
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    const d = Object.fromEntries(new FormData(f)), reg = f.dataset.form === 'reg', er = $('#err'), em = (d.email || '').trim().toLowerCase(), btn = f.querySelector('button');
    if (!/^\S+@\S+\.\S+$/.test(em)) return (er.textContent = 'Entrez une adresse e-mail valide.');
    if ((d.pw || '').length < 8) return (er.textContent = 'Le mot de passe doit contenir au moins 8 caractères.');
    if (reg && !(d.nom || '').trim()) return (er.textContent = 'Indiquez votre nom.');
    er.textContent = ''; btn.disabled = true;
    try {
      const u = reg ? await post('/auth/register', { name: d.nom.trim(), email: em, password: d.pw, role: d.role === 'entreprise' ? 'COMPANY' : 'YOUTH' }) : await post('/auth/login', { email: em, password: d.pw });
      sessionStorage.clear();
      location.href = u.role === 'COMPANY' ? 'entreprise/dashboard.html' : 'jeune/dashboard.html';
    } catch (x) { er.textContent = x.message; btn.disabled = false; }
  });
}
