# Alissa RAG — Exemple end-to-end

RAG (Retrieval-Augmented Generation) avec **Turso** (base vectorielle), un modèle d'embedding **open source local**, **GPT-4o-mini** pour la génération, et **ingestion de PDF** avec comptage de tokens.

## Stack

- **Embeddings** : `Xenova/multilingual-e5-small` via `@huggingface/transformers` — local, gratuit, multilingue (bon français), 384 dimensions.
- **Base vectorielle** : Turso / libSQL, colonne `F32_BLOB` native + index ANN cosinus.
- **LLM** : `gpt-4o-mini` (OpenAI).
- **Ingestion PDF** : `pdfjs-dist` (extraction texte) + chunking maison.
- **Comptage de tokens** : `tiktoken` (estimation locale) + chiffres réels de l'API OpenAI.
- **Serveur** : Express.js (sert aussi le front de test).

## Arborescence

```
alissa-rag/
├── package.json
├── .env.example
├── README.md
├── public/
│   └── index.html              # front de test (Tailwind + Font Awesome) : chat + upload PDF + tokens
├── src/
│   ├── config/config.js        # variables d'environnement centralisées
│   ├── embeddings/embeddings.js # génération des vecteurs (modèle local)
│   ├── db/db.js                # client Turso, schéma, insertion (simple + batch), recherche
│   ├── pdf/
│   │   ├── extract.js          # extraction du texte d'un PDF
│   │   ├── chunk.js            # découpage en passages avec chevauchement
│   │   └── ingest.js           # orchestration : extract → chunk → embed → insert
│   ├── tokens/counter.js       # comptage de tokens + calcul du coût
│   └── server/server.js        # serveur Express + endpoints
└── scripts/seed.js             # indexation de contenus d'exemple
```

## Installation

```bash
npm install
cp .env.example .env
# Renseigne TURSO_DATABASE_URL, TURSO_AUTH_TOKEN et OPENAI_API_KEY
```

> Au premier lancement, le modèle d'embedding (~120 Mo) est téléchargé et mis en cache.

## Lancement avec Gemini

```bash
npm run gemini

```

## Lancement avec GPT de OPEN AI

```bash
npm run openai
cp .env.example .env
# Renseigne TURSO_DATABASE_URL, TURSO_AUTH_TOKEN et OPENAI_API_KEY
```


## Utilisation

1. **Démarrer le serveur** : `npm run openai`
2. **Ouvrir l'interface** : http://localhost:3000
3. **Ajouter un PDF** : bouton « Ajouter un PDF » en haut à droite. Le PDF est extrait, découpé en passages, vectorisé et indexé dans Turso.
4. **Poser une question** : l'IA cherche dans tous les PDF indexés et répond. Sous chaque réponse s'affichent les sources consultées et les tokens (contexte / sortie) avec le coût estimé.

### Endpoints

- `POST /upload` — multipart, champ `pdf` + `matiere`/`niveau` optionnels. Indexe un PDF.
- `POST /ask` — `{ question }`. Renvoie `reponse`, `sources` et `usage` (tokens + coût).
- `POST /documents` — `{ contenu, matiere, niveau }`. Ajout manuel d'un texte.

```bash
# Upload d'un PDF
curl -X POST http://localhost:3000/upload \
  -F "pdf=@manuel-maths-4eme.pdf" \
  -F "matiere=Mathématiques" -F "niveau=4ème"

# Question
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Explique le théorème de Pythagore"}'
```

## Comptage de tokens

Le champ `usage` de `/ask` contient :
- `contexteTokens` : tokens envoyés au modèle (prompt système + question), d'après l'API OpenAI.
- `sortieTokens` : tokens de la réponse générée.
- `totalTokens` : somme.
- `contexteTokensEstime` : estimation locale via tiktoken (pour comparaison/anticipation).
- `cout` : coût en USD (entrée / sortie / total), basé sur la grille GPT-4o-mini.

> Les tarifs sont définis dans `src/tokens/counter.js` (`PRIX_INPUT_PAR_M`, `PRIX_OUTPUT_PAR_M`). Vérifie-les sur la grille OpenAI à jour.

## Notes sur les PDF

- Les PDF **scannés** (images sans couche texte) ne donneront rien à l'extraction : il faudrait y ajouter de l'OCR (ex : Tesseract). Le serveur renvoie une erreur explicite dans ce cas.
- Le chunking est réglable dans `src/pdf/chunk.js` (`TAILLE_CIBLE`, `CHEVAUCHEMENT`).

## Pistes d'amélioration

- **Re-ranking** : récupérer top-k=10 puis re-classer avec un cross-encoder.
- **Filtrage** : pré-filtrer la recherche par `matiere`/`niveau`.
- **OCR** : gérer les PDF scannés.
- **Suivi des coûts** : agréger les `usage` par élève pour piloter la marge.
