# SkillUp IA — projet complet (mode réel)

```
skillup/
├─ backend/    API Node.js + Express + Prisma + PostgreSQL (Supabase). Sert aussi le frontend.
├─ frontend/   Site public + espace jeune + espace entreprise (HTML, Tailwind, JavaScript vanilla)
└─ admin/      Espace administration : application SÉPARÉE, hébergée à part (autre domaine)
```

Il n'y a plus de données de démonstration : tout vient de l'API. Seule exception volontaire : si le fournisseur IA est absent ou en panne, le serveur renvoie une analyse de secours **signalée** (`fallback: true`) pour ne pas bloquer le jeune.

> **Guides :** `GUIDE_FOURNISSEUR_IA.md` (choisir et brancher l'IA) et `DEPLOIEMENT_VERCEL_SUPABASE.md` (Vercel + Supabase pas à pas).

## 1. Démarrage en local

Prérequis : Node.js 20+, une base PostgreSQL (Supabase recommandé).

```bash
cd backend
npm install
cp .env.example .env          # puis renseigner DATABASE_URL, JWT_SECRET (32+ caractères), ADMIN_EMAIL, ADMIN_PASSWORD…
npx prisma validate
npx prisma migrate dev --name init   # crée les tables
npm run db:seed                      # catalogue de compétences, défis du catalogue, emplacements pub, 1er administrateur
npm run dev                          # http://localhost:4000 (API + frontend)
npm run smoke                        # test de bout en bout du scénario complet (serveur démarré)
```

- Site (jeunes et entreprises) : http://localhost:4000
- Administration (à part) : `cd admin && npx serve -l 5173 .` → http://localhost:5173 (identifiants = `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

> **À savoir :** le backend n'a pas pu être exécuté contre Express, Prisma et PostgreSQL dans l'environnement où il a été écrit (pas d'accès réseau). Sa logique métier est testée (voir §6) et son code relu, mais **le premier démarrage réel est à faire avec `npm run smoke`** : il valide toute la chaîne.

## 2. Hébergement

| Élément | Où | Réglages clés |
|---|---|---|
| Backend + frontend (serveur unique) | Render, Railway, etc. (voir aussi le guide Vercel + Supabase) | Build : `cd backend && npm ci && npx prisma generate && npx prisma migrate deploy` · Start : `cd backend && npm start` · variables du `.env.example` |
| Base de données | Supabase | `DATABASE_URL` = chaîne « pooler » (port 6543, `?pgbouncer=true`), `DIRECT_URL` = connexion directe (5432) pour les migrations |
| **Administration** | **Vercel / Netlify / Cloudflare Pages (autre domaine)** | Dossier racine `admin/` · `assets/js/config.js` → URL de l'API · `vercel.json` / `_headers` : remplacer `api.votre-domaine.bj` |

Côté backend, pour l'admin hébergée à part : `ADMIN_ORIGIN=https://admin.votre-domaine.bj` (liste blanche CORS). Si le frontend est aussi hébergé ailleurs que l'API : `SERVE_FRONTEND=false`, `FRONTEND_ORIGIN=…`, `COOKIE_SAMESITE=none` (HTTPS obligatoire) et `window.SKILLUP_API` dans `frontend/assets/js/config.js`.

**Pourquoi deux modes d'authentification ?** Jeunes et entreprises : cookie `HttpOnly` + `Secure` + `SameSite` (jamais lisible par JavaScript). Administration : jeton Bearer d'audience « admin » (8 h), stocké en `sessionStorage`, car elle vit sur un autre domaine (les cookies tiers sont bloqués par Safari/Brave). Un jeton admin est refusé sur les routes publiques et inversement ; les comptes admin ne peuvent pas se connecter côté site.

## 3. API (préfixe `/api`, réponses `{ success, data | message }`)

| Domaine | Routes | Accès |
|---|---|---|
| Auth | `POST /auth/register` `/login` `/logout` · `GET /auth/me` | public / session |
| Jeune | `GET /youth/overview` · `GET/PUT /youth/profile` · `PUT /youth/preferences` · `POST /youth/skills/confirm` · `DELETE /youth/skills/:name` | jeune |
| IA | `POST /ai/skills/discover` · `POST /ai/transcribe` (audio → texte) · `POST /ai/jobs/decompose` | jeune / entreprise, limité à 15 appels / 10 min |
| Défis | `GET /challenges` `/challenges/:id` · `POST /submissions` (fichier ou lien) · `GET /submissions/me` · `POST /evaluations/:id/appeal` | jeune |
| Missions | `GET /jobs` `/jobs/:id` · `POST/PUT /jobs` · `PATCH /jobs/:id/status` · `GET /jobs/:id/matches` `/applications` · `POST /jobs/:id/applications` · `PATCH /applications/:id/status` | public / propriétaire |
| Entreprise | `GET/PUT /companies/me` · `GET /companies/me/overview` · `GET /talents` `/talents/:id` · favoris | entreprise |
| Abonnement | `GET /subscriptions/me` · `POST /subscriptions/checkout` · `POST /payments/webhook/:provider` | utilisateur / webhook signé |
| Publicités | `GET /ads/eligible?placement=` · `POST /ads/:id/impressions` `/click` | public |
| Autres | `POST /reports` · `GET /notifications` · `GET /skills` · `GET /files/:key` (URL signée 10 min) | selon route |
| Administration | `/admin/auth/login` · `/admin/stats` `/users` `/companies` `/jobs` `/challenges` `/submissions` `/evaluations` `/reports` `/payments` `/audit` `/placements` `/ads` (+ `approve` `activate` `pause` `reject`…) | admin / modérateur |

## 4. Règles métier appliquées côté serveur

- Les compétences de l'IA sont enregistrées **déclarées** ; livrable envoyé → **démontrée** ; validé par l'administration → **validée**. Les propositions IA restent côté serveur : le navigateur ne peut pas en inventer.
- Tout livrable (image, vidéo, document, lien) part chez l'administration. Le type réel du fichier est vérifié d'après ses octets (pas son nom), la taille est limitée, le stockage est privé.
- Matching : mêmes critères pour tous (déclaré 0,3 · démontré 0,7 · validé 1). Au plus 5 missions classées ; **gratuit = 50 %** (arrondi bas, minimum 1), **PRO = 100 %**. Le plan ne change jamais le score. Un jeune ne peut postuler qu'aux missions que sa formule lui affiche.
- PRO (1 450 XOF / 30 jours) ne s'active que par un webhook **signé (HMAC)**, vérifié (référence, montant, devise) et **idempotent** (rejouer ne réactive pas). Le retour du navigateur n'est jamais une preuve.
- Publicités : séparées du matching ; une annonce n'est servie que si `ACTIVE`, dans sa période, sur un emplacement actif, avec paiement confirmé de façon traçable ; URL en https uniquement.
- Actions sensibles journalisées (qui, quoi, quand, motif) ; motif obligatoire pour suspendre, refuser, demander une révision.
- Entreprise : ne voit que les preuves validées que le jeune a choisi de partager ; la décomposition IA doit être validée avant publication.

## 5. Ce qu'il reste à brancher (volontairement non inventé)

1. **Fournisseur IA** : `AI_PROVIDER` (`anthropic` ou `openai`-compatible), `AI_API_KEY`, `AI_MODEL`. Sans cela : analyse de secours.
2. **Transcription vocale** côté serveur (Firefox, etc.) : `TRANSCRIBE_*`. Chrome, Edge et Safari dictent directement dans le navigateur.
3. **Prestataire de paiement** (Mobile Money / carte au Bénin) : à choisir ; écrire l'adaptateur dans `backend/src/services/paymentProvider.js` (le chemin webhook signé existe déjà). `PAYMENT_PROVIDER=sandbox` n'est actif qu'hors production.
4. E-mail/SMS : vérification de contact et « mot de passe oublié » (non implémentés), notifications externes.
5. Stockage objet : le disque privé (`STORAGE_DIR`) convient à un serveur unique ; sur Render prévoir un disque persistant ou Supabase Storage.
6. Tailwind est chargé par CDN (rapide à démarrer) ; pour la production, le compiler (`tailwindcss` CLI) et retirer le CDN de la politique CSP.
7. Conformité Bénin (données personnelles, paiements, mise en relation) à vérifier avant ouverture commerciale ; procédures d'export/suppression des données à définir.
8. Interface jeune de contestation (`POST /evaluations/:id/appeal` existe) ; pagination côté interface jeune/entreprise.

## 6. Tests

```bash
cd backend  && npm test        # 10 tests : matching et quotas, webhook idempotent, publicités, fichiers, URL
cd frontend && node --test     # 4 tests : écrans jeune/entreprise contre le contrat réel de l'API
cd admin    && node --test     # 4 tests : écrans admin, jeton Bearer, motifs obligatoires
cd backend  && npm run smoke   # bout en bout, serveur démarré
```
