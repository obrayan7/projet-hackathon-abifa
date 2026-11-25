# Choisir et brancher le fournisseur IA

Fonctions d'IA du projet : (1) analyser la présentation d'un jeune et renvoyer un JSON (profil, compétences, défis), (2) aider l'entreprise à découper une mission, (3) transcrire une note vocale, (4) en option, évaluer un livrable. Le matching n'utilise PAS l'IA : il reste en règles pondérées, explicables et auditables.

## Recommandation (relevée le 17 novembre 2026, à revérifier sur les pages officielles)

| Besoin | Choix principal | Secours / gratuit |
|---|---|---|
| Analyse, défis, décomposition (texte vers JSON, français) | **Claude Haiku 5.5** (`claude-haiku-5-5`) | Gemini via son endpoint compatible OpenAI (palier gratuit) |
| Transcription des notes vocales | **Groq, Whisper Large v3 Turbo** | Dictée du navigateur (Chrome, Edge, Safari : déjà intégrée, gratuite) |

Pourquoi : le Bénin figure dans la liste des pays pris en charge par Anthropic ; Haiku 5.5 coûte 0,10 $ par million de jetons en entrée et 0,50 $ en sortie (prompts de 100 000 jetons ou moins) ; Groq facture Whisper Large v3 Turbo 0,04 $ de l'heure, avec un palier gratuit sans carte. Note : Anthropic et Groq sont ouverts à la facturation par carte ; vérifiez qu'une carte internationale (ou virtuelle) fonctionne pour vous avant le jour J.

Limites à connaître : Whisper couvre 99 langues dont le français et l'anglais, mais pas de façon fiable le fon ou le yoruba (à tester). Le palier gratuit de Gemini peut servir à améliorer les produits de Google : ne l'utilisez qu'avec des textes de test, jamais avec les vraies données de jeunes.

## Coût réel d'une analyse (estimation à partir des prix ci-dessus)

Hypothèses : 650 jetons envoyés, 800 jetons reçus, environ 600 FCFA pour 1 $ (taux à vérifier).
- 1 analyse ≈ 0,00047 $ ≈ **0,3 FCFA**. 1 000 analyses ≈ 280 FCFA.
- 1 minute de voix transcrite ≈ 0,00067 $ ≈ **0,4 FCFA**.
Un jeune très actif (5 analyses et 3 minutes de voix par mois) coûte donc de l'ordre de 3 FCFA, contre 1 450 FCFA pour un abonnement PRO.

## Brancher Claude (analyse)

1. Créez un compte sur https://platform.claude.com, ajoutez du crédit (le prépaiement peut être demandé), puis créez une clé API.
2. Dans les variables d'environnement du backend (Vercel : Settings > Environment Variables) :
```
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-haiku-5-5
```
3. Redéployez. Sans clé, le serveur renvoie une réponse de secours signalée (`fallback: true`).

## Brancher Groq (voix)

1. Créez un compte sur https://console.groq.com et une clé API.
2. Variables :
```
TRANSCRIBE_BASE_URL=https://api.groq.com/openai/v1
TRANSCRIBE_API_KEY=gsk_...
TRANSCRIBE_MODEL=whisper-large-v3-turbo
```

## Alternative : n'importe quel fournisseur compatible OpenAI (Gemini, Groq LLM, Mistral…)

```
AI_PROVIDER=openai
AI_BASE_URL=<adresse de base de l'API compatible OpenAI du fournisseur>
AI_API_KEY=<clé>
AI_MODEL=<nom du modèle>
```
Le serveur exige un JSON valide (validé par Zod) et retombe sur la réponse de secours en cas d'erreur, de dépassement de délai (25 s, une seule nouvelle tentative) ou de quota.

## Vérifier que ça marche

Connectez-vous comme jeune, écrivez « Je conçois des affiches avec Canva depuis 2 ans » et envoyez : l'écran ne doit PAS afficher « Réponse de secours ». Côté voix, testez sur Firefox (dictée du navigateur absente) : le micro doit utiliser `/api/ai/transcribe`.

## Sécurité et vie privée

- La clé reste uniquement dans les variables du serveur, jamais dans le frontend.
- Seul le texte de la présentation part vers le fournisseur (ni nom, ni e-mail). Informez les jeunes et recueillez leur consentement dans les conditions d'utilisation.
- Limite : 15 appels IA par utilisateur toutes les 10 minutes.
