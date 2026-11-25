# Déployer SkillUp IA sur Vercel + Supabase

Architecture : **3 projets Vercel** (API, site, administration) + **1 projet Supabase** (base PostgreSQL et stockage des fichiers). Le dépôt GitHub contient les dossiers `backend/`, `frontend/` et `admin/`.

```
Navigateur ── site (Vercel, dossier frontend) ──/api/* (réécriture)──> API (Vercel, dossier backend) ──> Supabase (base + stockage)
Navigateur ── administration (Vercel, dossier admin, autre domaine) ──jeton Bearer──> API
Navigateur ── envoi des livrables, directement ──> Supabase Storage (URL signée délivrée par l'API)
```

Pourquoi les fichiers vont directement à Supabase : une fonction Vercel refuse toute requête de plus de 4,5 Mo (erreur 413). Les images (5 Mo max), documents (10 Mo) et vidéos (30 Mo) ne passent donc pas par l'API.

## 0. Prérequis
Comptes GitHub, Vercel, Supabase ; Node.js 20+ sur votre machine. Vérifiez les conditions d'utilisation du plan gratuit de Vercel (usage non commercial) avant tout lancement commercial.

## 1. GitHub
```bash
cd skillup && git init && git add . && git commit -m "SkillUp IA"
# créez un dépôt vide sur GitHub, puis :
git remote add origin https://github.com/VOUS/skillup.git && git push -u origin main
```
Le `.gitignore` exclut `.env` et `node_modules` : ne poussez jamais de secrets.

## 2. Supabase
1. New project : choisissez un mot de passe de base fort (conservez-le) et une région proche de vos utilisateurs.
2. **Connect** > ORM / Prisma : copiez deux chaînes :
   - `DATABASE_URL` = **Transaction pooler** (port 6543), terminée par `?pgbouncer=true`.
   - `DIRECT_URL` = **Session pooler** (port 5432). Elle sert aux migrations depuis votre machine (compatible IPv4).
3. **Storage** > New bucket : nom `submissions`, **privé** (Public bucket désactivé).
4. **Project Settings > API** : notez `Project URL` et la clé `service_role` (SECRÈTE : uniquement dans les variables Vercel de l'API).

## 3. Créer les tables (une seule fois, depuis votre machine)
```bash
cd backend && npm install
cp .env.example .env     # renseignez DATABASE_URL, DIRECT_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma validate
npx prisma migrate dev --name init   # crée les tables ET le dossier prisma/migrations (à commiter)
npm run db:seed                      # compétences, défis du catalogue, emplacements pub, administrateur
git add . && git commit -m "migrations" && git push
```
`JWT_SECRET` : 32 caractères aléatoires au minimum (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Générez-en un second pour `FILE_SIGNING_SECRET`.

## 4. Projet Vercel n°1 : l'API
Vercel > Add New > Project > votre dépôt. **Root Directory : `backend`**, Framework : Other.
Variables d'environnement (Production) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | chaînes Supabase de l'étape 2 |
| `JWT_SECRET`, `FILE_SIGNING_SECRET` | secrets aléatoires |
| `SERVE_FRONTEND` | `false` |
| `FRONTEND_ORIGIN` | URL du site (étape 5), par ex. `https://skillup-site.vercel.app` |
| `ADMIN_ORIGIN` | URL de l'administration (étape 6) |
| `COOKIE_SAMESITE` | `lax` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | étape 2 (`submissions`) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | voir GUIDE_FOURNISSEUR_IA.md |
| `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_API_KEY`, `TRANSCRIBE_MODEL` | voir le même guide |
| `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, `PRO_PRICE_XOF`, `PRO_DAYS` | `sandbox`, secret aléatoire, `1450`, `30` |
| `ALLOW_SANDBOX_PAYMENTS` | `true` **pour la démonstration uniquement** (active le simulateur de paiement en production ; à retirer avant tout lancement commercial) |

Déployez, puis ouvrez `https://VOTRE-API.vercel.app/api/health` : réponse `{"success":true,...}`. Les URLs `FRONTEND_ORIGIN` et `ADMIN_ORIGIN` seront connues après les étapes 5 et 6 : revenez les renseigner puis **redéployez** l'API.

## 5. Projet Vercel n°2 : le site (jeunes et entreprises)
Add New > Project > même dépôt. **Root Directory : `frontend`**, Framework : Other, pas de build.
Avant de déployer, dans `frontend/vercel.json`, remplacez `https://VOTRE-API.vercel.app` par l'URL réelle de l'API (étape 4), commitez et poussez.
Le site appelle `/api/...` sur SON domaine ; Vercel relaie vers l'API. Le cookie de session reste ainsi « de première partie » (aucun blocage Safari).

## 6. Projet Vercel n°3 : l'administration (séparée)
Add New > Project > même dépôt. **Root Directory : `admin`**. Avant de déployer :
- `admin/assets/js/config.js` : `window.SKILLUP_API = 'https://VOTRE-API.vercel.app'`
- `admin/vercel.json` : remplacez `https://api.votre-domaine.bj` par l'URL de l'API dans `connect-src`.
Ensuite, renseignez cette URL d'administration dans `ADMIN_ORIGIN` de l'API et redéployez l'API.
Connexion : `ADMIN_EMAIL` / `ADMIN_PASSWORD` (étape 3).

## 7. Vérifier
```bash
cd backend
BASE=https://VOTRE-API.vercel.app npm run smoke     # lit ADMIN_EMAIL, ADMIN_PASSWORD, PAYMENT_WEBHOOK_SECRET dans .env
```
Puis un essai à la main : inscription jeune sur le site, présentation, défi avec une image de plus de 5 Mo (refusée) puis de 1 Mo (acceptée), validation dans l'administration.

## 8. Domaine (facultatif)
Vercel > Domains : par ex. `skillup.exemple.bj` (site) et `admin.skillup.exemple.bj` (administration). Mettez à jour `FRONTEND_ORIGIN`, `ADMIN_ORIGIN`, `config.js`, `connect-src`, puis redéployez.

## Problèmes fréquents
| Symptôme | Cause et remède |
|---|---|
| `P1001` ou `P1002` pendant la migration | Utilisez le **Session pooler** pour `DIRECT_URL` (la connexion directe de Supabase est en IPv6) |
| Erreur « prepared statement » | `DATABASE_URL` doit se terminer par `?pgbouncer=true` |
| `413 FUNCTION_PAYLOAD_TOO_LARGE` | Un fichier passe par l'API : vérifiez que `SUPABASE_URL` et la clé sont définis (dépôt direct actif, `/api/config` renvoie `direct`) |
| Connexion impossible côté site | `FRONTEND_ORIGIN` identique à l'URL du site (sans `/` final) ; redéployez l'API après modification |
| Admin : « Connexion au serveur impossible » | `ADMIN_ORIGIN` et `config.js` ; l'API doit autoriser exactement l'origine de l'admin |
| Images invisibles chez l'admin | Bucket nommé `submissions` et clé `service_role` correcte ; l'URL signée expire après 5 à 10 minutes (rechargez la page) |
| Premier appel lent | Démarrage à froid d'une fonction Vercel ; faites un appel `/api/health` avant la démonstration |
| Base inaccessible le jour J | Les projets Supabase gratuits peuvent être mis en pause après une période d'inactivité : ouvrez le tableau de bord la veille |

## Avant la démonstration
- Compte jeune et compte entreprise créés à l'avance, plus un livrable déjà validé en secours.
- Appel `/api/health` fait, clés IA valides, crédit disponible.
- Plan B : si l'IA ou Internet tombe, l'analyse de secours est signalée à l'écran ; gardez une courte vidéo du parcours.
