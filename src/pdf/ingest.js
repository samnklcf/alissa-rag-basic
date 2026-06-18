import { extractPdfText } from "./extract.js";
import { chunkText } from "./chunk.js";
import { embedBatch } from "../embeddings/embeddings.js";
import { insertDocuments } from "../db/db.js";

/**
 * Ingère un PDF complet : extraction → découpage → embeddings → insertion.
 *
 * @param {Buffer} buffer - contenu binaire du PDF
 * @param {object} meta - métadonnées { source, matiere, niveau }
 * @returns {Promise<{ source, numPages, chunks, charsExtracted }>}
 */
export async function ingestPdf(buffer, { source, matiere, niveau } = {}) {
  // 1. Extraction du texte
  const { text, numPages } = await extractPdfText(buffer);

  if (!text.trim()) {
    throw new Error(
      "Aucun texte extrait du PDF. Il s'agit peut-être d'un PDF scanné (image) qui nécessiterait de l'OCR."
    );
  }

  // 2. Découpage en chunks
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("Le découpage n'a produit aucun passage exploitable.");
  }

  // 3. Embeddings de tous les chunks en une passe
  const embeddings = await embedBatch(chunks, "passage");

  // 4. Insertion par lot dans Turso
  const docs = chunks.map((contenu, i) => ({
    contenu,
    matiere,
    niveau,
    source,
    embedding: embeddings[i],
  }));
  await insertDocuments(docs);

  return {
    source,
    numPages,
    chunks: chunks.length,
    charsExtracted: text.length,
  };
}
