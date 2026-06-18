import { createClient } from "@libsql/client";
import { EMBEDDING_DIM } from "../embeddings/embeddings.js";
import { config } from "../config/config.js";

export const db = createClient({
  url: config.turso.url,
  authToken: config.turso.authToken,
});

/**
 * Crée la table des documents et l'index vectoriel s'ils n'existent pas.
 * - embedding F32_BLOB(384) : colonne vectorielle native de libSQL.
 * - libsql_vector_idx avec metric=cosine : index ANN pour des recherches rapides.
 * - source : nom du fichier PDF d'origine (utile pour citer la provenance).
 */
export async function initSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contenu TEXT NOT NULL,
      matiere TEXT,
      niveau TEXT,
      source TEXT,
      embedding F32_BLOB(${EMBEDDING_DIM})
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_documents_embedding
    ON documents (libsql_vector_idx(embedding, 'metric=cosine'));
  `);
}

/**
 * Insère un document avec son embedding.
 * vector32(...) convertit le tableau JSON en blob vectoriel côté Turso.
 */
export async function insertDocument({ contenu, matiere, niveau, source, embedding }) {
  await db.execute({
    sql: `
      INSERT INTO documents (contenu, matiere, niveau, source, embedding)
      VALUES (?, ?, ?, ?, vector32(?));
    `,
    args: [contenu, matiere ?? null, niveau ?? null, source ?? null, JSON.stringify(embedding)],
  });
}

/**
 * Insère plusieurs chunks d'un coup (utilisé après l'ingestion d'un PDF).
 * On utilise une transaction batch pour la performance.
 * @param {Array<{contenu, matiere, niveau, source, embedding}>} docs
 */
export async function insertDocuments(docs) {
  if (docs.length === 0) return;

  const statements = docs.map((d) => ({
    sql: `
      INSERT INTO documents (contenu, matiere, niveau, source, embedding)
      VALUES (?, ?, ?, ?, vector32(?));
    `,
    args: [
      d.contenu,
      d.matiere ?? null,
      d.niveau ?? null,
      d.source ?? null,
      JSON.stringify(d.embedding),
    ],
  }));

  await db.batch(statements, "write");
}

/**
 * Recherche les k documents les plus proches d'un vecteur de requête.
 * On utilise vector_top_k sur l'index, puis on rejoint la table pour
 * récupérer le contenu. vector_distance_cos donne le score de distance.
 */
export async function searchSimilar(queryEmbedding, k = 4) {
  const result = await db.execute({
    sql: `
      SELECT d.id, d.contenu, d.matiere, d.niveau, d.source,
             vector_distance_cos(d.embedding, vector32(?)) AS distance
      FROM vector_top_k('idx_documents_embedding', vector32(?), ?) AS v
      JOIN documents d ON d.id = v.id
      ORDER BY distance ASC;
    `,
    args: [
      JSON.stringify(queryEmbedding),
      JSON.stringify(queryEmbedding),
      k,
    ],
  });
  return result.rows;
}
