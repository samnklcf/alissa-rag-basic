import { initSchema, insertDocument } from "../src/db/db.js";
import { embedBatch } from "../src/embeddings/embeddings.js";

// Quelques contenus pédagogiques d'exemple (à remplacer par ton vrai curriculum).
const CONTENUS = [
  {
    contenu:
      "Le théorème de Pythagore énonce que dans un triangle rectangle, le carré de la longueur de l'hypoténuse est égal à la somme des carrés des longueurs des deux autres côtés. Si a et b sont les côtés de l'angle droit et c l'hypoténuse, alors a² + b² = c².",
    matiere: "Mathématiques",
    niveau: "4ème",
  },
  {
    contenu:
      "La photosynthèse est le processus par lequel les plantes vertes utilisent la lumière du soleil pour transformer le dioxyde de carbone et l'eau en glucose et en oxygène. Elle se déroule principalement dans les chloroplastes grâce à la chlorophylle.",
    matiere: "SVT",
    niveau: "5ème",
  },
  {
    contenu:
      "Une équation du premier degré à une inconnue est de la forme ax + b = 0, où a est différent de 0. Pour la résoudre, on isole l'inconnue x : x = -b / a.",
    matiere: "Mathématiques",
    niveau: "4ème",
  },
  {
    contenu:
      "Le Gabon est un pays d'Afrique centrale situé sur l'équateur. Sa capitale est Libreville. Il est bordé par l'océan Atlantique à l'ouest, le Cameroun au nord, la Guinée équatoriale au nord-ouest et le Congo à l'est et au sud.",
    matiere: "Géographie",
    niveau: "6ème",
  },
  {
    contenu:
      "Un verbe du premier groupe se termine par -er à l'infinitif (sauf 'aller'). Au présent de l'indicatif, les terminaisons sont : -e, -es, -e, -ons, -ez, -ent. Exemple avec le verbe chanter : je chante, tu chantes, il chante, nous chantons, vous chantez, ils chantent.",
    matiere: "Français",
    niveau: "6ème",
  },
  {
    contenu:
      "La cellule est l'unité de base du vivant. On distingue les cellules animales et végétales. La cellule végétale possède une paroi, des chloroplastes et une grande vacuole, contrairement à la cellule animale.",
    matiere: "SVT",
    niveau: "5ème",
  },
];



