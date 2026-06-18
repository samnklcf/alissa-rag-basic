import express from "express";
import OpenAI from "openai";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initSchema, insertDocument, searchSimilar } from "../db/db.js";
import { embed, getExtractor } from "../embeddings/embeddings.js";
import { ingestPdf } from "../pdf/ingest.js";
import { countTokens, computeCost } from "../tokens/counter.js";
import { config } from "../config/config.js";

// En modules ES, __dirname n'existe pas : on le reconstruit.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Sert le front de test (public/index.html) à la racine.
app.use(express.static(path.resolve(__dirname, "../../public")));

// Multer en mémoire : les PDF ne sont pas écrits sur disque, on traite le buffer
// directement. Limite à 25 Mo par fichier (un manuel scolaire reste en dessous).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Seuls les fichiers PDF sont acceptés."));
  },
});

// ---------------------------------------------------------------------------
// Client OpenAI pour la génération (GPT-4o-mini)
// L'embedding reste local et inchangé (Xenova/multilingual-e5-small,
// voir embeddings.js) ; seule la génération de la réponse passe par l'API.
// ---------------------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = "gpt-4o-mini";

// Précharge le modèle d'embedding dès le démarrage du serveur : ça évite la
// latence sur la toute première requête, et les logs ci-dessous te disent
// précisément quand le téléchargement/chargement est terminé.
getExtractor().catch((err) =>
  console.error("❌ Erreur de chargement du modèle d'embedding :", err)
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit le prompt système d'Alissa à partir des passages récupérés.
 */
function buildSystemPrompt(passages) {
  const contexte = passages
    .map(
      (p, i) =>
        `[Source ${i + 1} — ${p.matiere ?? "Général"}, ${p.niveau ?? "tous niveaux"}${
          p.source ? `, fichier: ${p.source}` : ""
        }]\n${p.contenu}`
    )
    .join("\n\n");

  return `Tu es Alissa, une tutrice pédagogique bienveillante pour les élèves du collège et du lycée au Gabon.

Réponds à la question de l'élève en t'appuyant en priorité sur le contexte ci-dessous, issu des documents pédagogiques. Si le contexte ne suffit pas, complète avec tes connaissances mais reste fidèle au niveau scolaire de l'élève. Explique de manière claire, simple et encourageante.

CONTEXTE :
${contexte}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /ask
 * Body : { question: string, k?: number }
 * Pipeline RAG : embedding local (Xenova) + génération via l'API OpenAI (GPT-4o-mini).
 */
app.post("/ask", async (req, res) => {
  try {
    const { question, k = 4 } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Le champ 'question' est requis." });
    }

    // 1. Embedding de la question
    const queryEmbedding = await embed(question, "query");

    // 2. Récupération des passages pertinents
    const passages = await searchSimilar(queryEmbedding, k);

    // 3. Construction du prompt (rôles system / user natifs à l'API Chat)
    const systemPrompt = buildSystemPrompt(passages);

    // Estimation locale du nombre de tokens en entrée (avant l'appel API).
    const contexteTokensEstime = countTokens(systemPrompt) + countTokens(question);

    // 4. Génération avec GPT-4o-mini (appel API OpenAI)
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 1, // faible température = réponses plus déterministes
      max_tokens: 800,  // longueur maximale de la réponse générée
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const reponse = completion.choices[0].message.content;

    // 5. Comptage des tokens : on utilise les chiffres réels renvoyés par
    //    l'API (plus fiables que l'estimation tiktoken faite avant l'appel).
    const inputTokens  = completion.usage?.prompt_tokens ?? contexteTokensEstime;
    const outputTokens = completion.usage?.completion_tokens ?? countTokens(reponse);

    // Coût réel basé sur la grille tarifaire gpt-4o-mini (voir tokens/counter.js)
    const { inputUsd, outputUsd, totalUsd } = computeCost(inputTokens, outputTokens);
    const cout = { entreeUsd: inputUsd, sortieUsd: outputUsd, totalUsd };

    res.json({
      reponse,
      sources: passages.map((p) => ({
        matiere: p.matiere,
        niveau: p.niveau,
        source: p.source,
        extrait: p.contenu.slice(0, 600) + "...",
        distance: p.distance,
      })),
      usage: {
        contexteTokens: inputTokens,
        sortieTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        contexteTokensEstime,
        cout,
      },
    });
  } catch (err) {
    console.error("Erreur /ask :", err);
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

/**
 * POST /upload
 * Multipart : champ "pdf" (fichier) + champs optionnels matiere, niveau.
 * Extrait, découpe, embarque et indexe le PDF dans Turso.
 */
app.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier PDF reçu (champ 'pdf')." });
    }
    const { matiere, niveau } = req.body;

    const result = await ingestPdf(req.file.buffer, {
      source: req.file.originalname,
      matiere: matiere || null,
      niveau: niveau || null,
    });

    res.status(201).json({
      message: "PDF indexé avec succès.",
      ...result,
    });
  } catch (err) {
    console.error("Erreur /upload :", err);
    res.status(500).json({ error: err.message || "Erreur pendant l'ingestion du PDF." });
  }
});

/**
 * POST /documents
 * Body : { contenu: string, matiere?: string, niveau?: string }
 * Ajout manuel d'un contenu texte (conservé pour compatibilité).
 */
app.post("/documents", async (req, res) => {
  try {
    const { contenu, matiere, niveau } = req.body;
    if (!contenu) {
      return res.status(400).json({ error: "Le champ 'contenu' est requis." });
    }
    const embedding = await embed(contenu, "passage");
    await insertDocument({ contenu, matiere, niveau, embedding });
    res.status(201).json({ message: "Document indexé." });
  } catch (err) {
    console.error("Erreur /documents :", err);
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

// Gestion des erreurs multer (taille, type de fichier).
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

// On s'assure que le schéma existe avant de démarrer le serveur.
initSchema()
  .then(() => {
    app.listen(config.server.port, () => {
      console.log(`🎓 Alissa RAG (GPT-4o-mini) en écoute sur http://localhost:${config.server.port}`);
    });
  })
  .catch((err) => {
    console.error("Impossible d'initialiser la base :", err);
    process.exit(1);
  });