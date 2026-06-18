
# Alissa RAG — Exemple End-to-End

Projet de démonstration d'un pipeline **RAG** (Retrieval-Augmented Generation) complet. Il intègre **Turso** comme base vectorielle native, un modèle d'embedding **open-source local**, **GPT-4o-mini** (ou **Gemini**) pour la génération, et un système d'**ingestion de PDF** avec suivi des tokens et calcul des coûts.

## Stack Technique

- **Embeddings** : `Xenova/multilingual-e5-small` via `@huggingface/transformers` — local, gratuit, performant en français (384 dimensions).
- **Base vectorielle** : Turso / libSQL (colonne `F32_BLOB` native + index ANN cosinus).
- **LLMs** : `gpt-4o-mini` (OpenAI) ou `Gemini` (Google).
- **Ingestion PDF** : `pdfjs-dist` (extraction de texte brut) + découpage (chunking) personnalisé.
- **Comptage de tokens** : `tiktoken` (estimation locale) + métriques réelles des API.
- **Serveur** : Express.js (API REST + service de l'interface de test).

---

## Arborescence du Projet

```text
alissa-rag/
├── package.json
├── .env.example
├── README.md
├── public/
│   └── index.html              # Interface de test (Tailwind + Font Awesome) : chat, upload & tokens
├── src/
│   ├── config/config.js        # Centralisation des variables d'environnement
│   ├── embeddings/embeddings.js # Génération locale des vecteurs
│   ├── db/db.js                # Client Turso, schéma, requêtes ANN (simple + batch)
│   ├── pdf/
│   │   ├── extract.js          # Extraction du texte brut des PDF
│   │   ├── chunk.js            # Découpage des textes en passages avec chevauchement
│   │   └── ingest.js           # Orchestration : Extraction ➔ Chunking ➔ Embedding ➔ Insertion
│   ├── tokens/counter.js       # Calcul des tokens et estimation des coûts financiers
│   └── server/
│       ├── server.js           # Serveur configuré pour Google Gemini
│       └── server-open-ai.js   # Serveur configuré pour OpenAI
└── scripts/seed.js             # Script pour indexer rapidement des données de test

```

---

## Installation et Configuration

### 1. Cloner et installer les dépendances

```bash
npm install

```

### 2. Configurer les variables d'environnement

Copiez le fichier d'exemple :

```bash
cp .env.example .env

```

Ouvrez le fichier `.env` et complétez les variables selon vos besoins :

```env
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
OPENAI_API_KEY=your_openai_api_key   # Requis pour le script OpenAI
GEMINI_API_KEY=your_gemini_api_key   # Requis pour le script Gemini

```

> 💡 **Note sur les Embeddings** : Au tout premier lancement, le modèle d'embedding (~120 Mo) est automatiquement téléchargé et mis en cache localement dans votre projet. Les lancements suivants seront instantanés.

---

## Lancement de l'Application

Démarrez le serveur selon le fournisseur de LLM que vous souhaitez exploiter :

```bash
# Pour utiliser OpenAI (GPT-4o-mini)
npm run openai

# Pour utiliser Google Gemini
npm run gemini

```

---

## Guide d'Utilisation

1. Ouvrez votre navigateur et accédez à : `http://localhost:3000`
2. **Indexation** : Cliquez sur le bouton **« Ajouter un PDF »** en haut à droite. Le document est extrait, découpé en segments (chunks), vectorisé localement puis stocké dans Turso.
3. **Recherche & Chat** : Posez une question dans le chat. Le système récupère les segments les plus pertinents dans Turso, construit le prompt de contexte, et le LLM formule sa réponse.
4. **Métriques** : Sous chaque réponse, les **sources utilisées** ainsi que le **coût financier précis** s'affichent en temps réel.

### Points d'entrée de l'API (Endpoints)

* `POST /upload` — *(Multipart)* Reçoit le fichier dans le champ `pdf` + métadonnées optionnelles `matiere` et `niveau`. Indexe le document.
* `POST /documents` — `{ contenu, matiere, niveau }`. Permet l'indexation manuelle d'un texte brut sans passer par un PDF.
* `POST /ask` — `{ question }`. Retourne la `reponse`, les `sources` correspondantes et l'objet de consommation `usage`.

#### Exemples de requêtes cURL

```bash
# Téléverser et indexer un fichier PDF
curl -X POST http://localhost:3000/upload \
  -F "pdf=@manuel-maths-4eme.pdf" \
  -F "matiere=Mathématiques" \
  -F "niveau=4ème"

# Poser une question au système RAG
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Explique le théorème de Pythagore"}'

```

---

## Gestion des Limites & Métriques

### Suivi des tokens et des coûts

L'objet `usage` renvoyé par l'endpoint `/ask` fournit une transparence totale sur la consommation :

* `contexteTokens` : Volume consommé par le prompt système et la question (chiffre réel fourni par l'API).
* `sortieTokens` : Volume de tokens généré pour la réponse.
* `contexteTokensEstime` : Estimation calculée côté serveur par `tiktoken` avant l'envoi (utile pour anticiper les dépassements de limites).
* `cout` : Calcul en USD basé sur la grille tarifaire active (configurable dans `src/tokens/counter.js`).

### Traitement des PDF

* **PDF Scannés** : L'extraction actuelle repose uniquement sur la couche texte des documents. Les PDF d'origine "image" (scans sans couche texte) renverront une erreur explicite.
* **Ajustements** : La taille des segments (`TAILLE_CIBLE`) et la zone de recouvrement (`CHEVAUCHEMENT`) sont modifiables directement dans `src/pdf/chunk.js`.

---

## Pistes d'Amélioration

* **Re-ranking** : Récupérer un Top-K large (ex: 10 segments) dans Turso, puis appliquer un modèle de *cross-encoder* local pour réordonner les résultats les plus pertinents.
* **Filtrage Hybride** : Exploiter nativement les métadonnées `matiere` et `niveau` dans la clause SQL de recherche vectorielle pour cloisonner les recherches.
* **Pipeline OCR** : Intégrer `Tesseract.js` pour gérer de manière transparente les PDF scannés et les images.
* **Suivi Analytique** : Associer chaque requête à un identifiant utilisateur/élève afin d'agréger les coûts et piloter les marges de l'application.


