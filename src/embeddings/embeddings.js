import { pipeline } from "@huggingface/transformers";

// On charge le modèle une seule fois (singleton) pour éviter de le recharger
// à chaque requête. multilingual-e5-small = 384 dimensions, bon support du français.
const MODEL_NAME = "Xenova/multilingual-e5-small";
export const EMBEDDING_DIM = 384;

let extractorPromise = null;

export function getExtractor() {
  if (!extractorPromise) {
    console.log("⏳ Chargement du modèle d'embedding (Xenova/multilingual-e5-small)...");
    extractorPromise = pipeline("feature-extraction", MODEL_NAME).then((extractor) => {
      console.log("✅ Modèle d'embedding chargé et prêt.");
      return extractor;
    });
  }
  return extractorPromise;
}

/**
 * Les modèles E5 attendent un préfixe :
 *  - "passage: " pour les documents qu'on indexe
 *  - "query: "   pour les questions des utilisateurs
 * Respecter ces préfixes améliore nettement la qualité de la recherche.
 */
function withPrefix(text, type) {
  return type === "query" ? `query: ${text}` : `passage: ${text}`;
}

/**
 * Génère un embedding normalisé pour un texte.
 * @param {string} text
 * @param {"passage"|"query"} type
 * @returns {Promise<number[]>} vecteur de 384 floats
 */
export async function embed(text, type = "passage") {
  const extractor = await getExtractor();
  const output = await extractor(withPrefix(text, type), {
    pooling: "mean",
    normalize: true, // important : on normalise pour la similarité cosinus
  });
  return Array.from(output.data);
}

/**
 * Version batch (plus efficace pour indexer plein de documents d'un coup).
 * @param {string[]} texts
 * @param {"passage"|"query"} type
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts, type = "passage") {
  const extractor = await getExtractor();
  const prefixed = texts.map((t) => withPrefix(t, type));
  const output = await extractor(prefixed, {
    pooling: "mean",
    normalize: true,
  });
  // output.data est un Float32Array aplati ; on le redécoupe en vecteurs.
  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(output.data.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM)));
  }
  return vectors;
}