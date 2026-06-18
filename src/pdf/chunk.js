/**
 * Découpe un texte en passages (chunks) pour l'indexation RAG.
 *
 * Pourquoi chunker ? Un manuel scolaire fait des dizaines de pages. Si on
 * l'embarque en un seul vecteur, la recherche devient floue (le vecteur
 * "moyenne" trop de concepts). En découpant en passages cohérents, chaque
 * vecteur représente une idée précise, et la recherche est bien plus pertinente.
 *
 * Stratégie : on découpe d'abord par paragraphes, puis on regroupe les
 * paragraphes jusqu'à atteindre une taille cible. On ajoute un chevauchement
 * (overlap) entre chunks pour ne pas couper une idée en deux sans recouvrement.
 */

const TAILLE_CIBLE = 1000; // caractères visés par chunk (~200-250 mots)
const CHEVAUCHEMENT = 150; // caractères repris du chunk précédent

/**
 * Nettoie le texte brut extrait d'un PDF :
 * - normalise les espaces et sauts de ligne multiples
 * - supprime les espaces en trop
 */
function nettoyer(texte) {
  return texte
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Découpe un texte en chunks.
 * @param {string} texte - texte brut (déjà extrait du PDF)
 * @param {object} options
 * @returns {string[]} liste de passages
 */
export function chunkText(texte, { tailleCible = TAILLE_CIBLE, chevauchement = CHEVAUCHEMENT } = {}) {
  const propre = nettoyer(texte);
  if (!propre) return [];

  // On découpe par paragraphes (double saut de ligne), puis par phrases
  // si un paragraphe est trop long à lui seul.
  const paragraphes = propre.split(/\n\n+/);

  const chunks = [];
  let courant = "";

  const pousser = () => {
    const t = courant.trim();
    if (t.length > 0) chunks.push(t);
    courant = "";
  };

  for (const para of paragraphes) {
    // Si le paragraphe seul dépasse largement la cible, on le découpe par phrases.
    if (para.length > tailleCible * 1.5) {
      const phrases = para.split(/(?<=[.!?])\s+/);
      for (const phrase of phrases) {
        if ((courant + " " + phrase).length > tailleCible) {
          pousser();
        }
        courant += (courant ? " " : "") + phrase;
      }
      continue;
    }

    if ((courant + "\n\n" + para).length > tailleCible) {
      pousser();
    }
    courant += (courant ? "\n\n" : "") + para;
  }
  pousser();

  // Ajout du chevauchement : on préfixe chaque chunk (sauf le premier) avec
  // la fin du chunk précédent, pour préserver le contexte aux frontières.
  if (chevauchement > 0 && chunks.length > 1) {
    return chunks.map((chunk, i) => {
      if (i === 0) return chunk;
      const precedent = chunks[i - 1];
      const debut = precedent.slice(Math.max(0, precedent.length - chevauchement));
      return debut + " " + chunk;
    });
  }

  return chunks;
}
