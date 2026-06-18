import { encoding_for_model } from "tiktoken";

// Tarifs GPT-4o-mini (USD pour 1 million de tokens).
// Source : grille tarifaire OpenAI. À ajuster si les prix changent.
const PRIX_INPUT_PAR_M = 0.15; // $ / 1M tokens en entrée
const PRIX_OUTPUT_PAR_M = 0.6; // $ / 1M tokens en sortie

// On réutilise un seul encodeur (coûteux à créer). gpt-4o-mini utilise
// l'encodage o200k_base, comme gpt-4o.
let encoder = null;
function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model("gpt-4o-mini");
  }
  return encoder;
}

/**
 * Compte le nombre de tokens d'un texte.
 * @param {string} texte
 * @returns {number}
 */
export function countTokens(texte) {
  if (!texte) return 0;
  return getEncoder().encode(texte).length;
}

/**
 * Calcule le coût en USD à partir des tokens d'entrée et de sortie.
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {{ inputUsd: number, outputUsd: number, totalUsd: number }}
 */
export function computeCost(inputTokens, outputTokens) {
  const inputUsd = (inputTokens / 1_000_000) * PRIX_INPUT_PAR_M;
  const outputUsd = (outputTokens / 1_000_000) * PRIX_OUTPUT_PAR_M;
  return {
    inputUsd,
    outputUsd,
    totalUsd: inputUsd + outputUsd,
  };
}
