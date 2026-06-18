// On utilise la build "legacy" de pdfjs-dist : elle fonctionne en Node.js
// sans dépendre des API navigateur (DOMMatrix, etc.). Les warnings éventuels
// sur DOMMatrix/Path2D n'affectent pas l'extraction de texte.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let pdfjsPromise = null;
function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsPromise;
}

/**
 * Extrait tout le texte d'un PDF.
 * @param {Buffer|Uint8Array} buffer - contenu binaire du PDF
 * @returns {Promise<{ text: string, numPages: number }>}
 */
export async function extractPdfText(buffer) {
  const pdfjs = await getPdfjs();
  // pdfjs exige un Uint8Array "pur" : un Buffer Node échoue même s'il hérite
  // d'Uint8Array. On recopie donc toujours dans un Uint8Array neuf.
  const data = new Uint8Array(
    buffer.buffer ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer
  );

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    // Silence les logs verbeux de pdf.js
    verbosity: 0,
  }).promise;

  const numPages = doc.numPages;
  let texte = "";
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // On reconstitue le texte de la page en joignant les fragments.
    const pageTexte = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    texte += pageTexte + "\n\n";
  }

  await doc.destroy();

  return { text: texte, numPages };
}
