import type { Arete, AretePonderee } from './graphe';

export type Point = [number, number];

interface Commun {
  id: string;
  titre: string;
  notion: string;
  enonce: string;
  explication: string[];
  /** Libellé de ce que l'on compte pour les étoiles. */
  libelleCoups: string;
  /** Seuils : coups ≤ s[0] → 3 étoiles, coups ≤ s[1] → 2 étoiles, sinon 1. */
  seuils: [number, number];
  positions: Point[];
  etiquettes?: string[];
}

export type Niveau =
  | (Commun & { type: 'arbre'; candidates: Arete[] })
  | (Commun & { type: 'euler'; aretes: Arete[]; possible: boolean; decor?: 'riviere' })
  | (Commun & { type: 'coloration'; aretes: Arete[]; k: number })
  | (Commun & { type: 'biparti'; aretes: Arete[] })
  | (Commun & { type: 'dijkstra'; aretes: AretePonderee[]; source: number; cible: number })
  | (Commun & { type: 'hamilton'; aretes: Arete[] })
  | (Commun & { type: 'isomorphisme'; aretes: Arete[]; cible: Arete[]; depart: number[] });

// Largeur 360, hauteur 460 : repère commun à tous les plateaux.

const cube: Arete[] = [];
for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (i < (i ^ b)) cube.push([i, i ^ b]);
const ordreCube = [0, 6, 3, 5, 1, 7, 2, 4];
const positionsCube: Point[] = new Array(8);
ordreCube.forEach((s, k) => {
  const a = -Math.PI / 2 + (k * 2 * Math.PI) / 8;
  positionsCube[s] = [180 + 140 * Math.cos(a), 230 + 140 * Math.sin(a)];
});

const petersen: Arete[] = [];
const positionsPetersen: Point[] = [];
for (let i = 0; i < 5; i++) {
  petersen.push([i, (i + 1) % 5], [i, i + 5], [i + 5, ((i + 2) % 5) + 5]);
}
for (const r of [150, 72]) {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    positionsPetersen.push([180 + r * Math.cos(a), 238 + r * Math.sin(a)]);
  }
}

const prisme: Arete[] = [
  [0, 1], [1, 2], [2, 0],
  [3, 4], [4, 5], [5, 3],
  [0, 3], [1, 4], [2, 5],
];
const positionsPrisme: Point[] = [];
for (const r of [155, 70]) {
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    positionsPrisme.push([180 + r * Math.cos(a), 250 + r * Math.sin(a)]);
  }
}

export const NIVEAUX: Niveau[] = [
  {
    id: 'arbre',
    type: 'arbre',
    titre: 'Relier l’île',
    notion: 'Arbre couvrant',
    enonce: 'Touchez les routes en pointillé pour relier tous les villages, avec le moins de routes possible.',
    libelleCoups: 'routes construites',
    seuils: [7, 9],
    positions: [
      [70, 90], [200, 70], [305, 135], [120, 215],
      [255, 240], [65, 355], [195, 385], [310, 345],
    ],
    candidates: [
      [0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4], [3, 4],
      [3, 5], [3, 6], [4, 6], [4, 7], [5, 6], [6, 7], [2, 7],
    ],
    explication: [
      'Un graphe connexe à n sommets possède au moins n − 1 arêtes.',
      'Lorsqu’il en a exactement n − 1, il ne contient aucun cycle : c’est un arbre. Vous venez de construire un arbre couvrant, qui relie les 8 villages avec 7 routes.',
    ],
  },
  {
    id: 'trait',
    type: 'euler',
    titre: 'D’un seul trait',
    notion: 'Chemin eulérien',
    enonce: 'Passez par chaque arête une seule fois, sans lever le doigt.',
    libelleCoups: 'tentatives',
    seuils: [0, 2],
    possible: true,
    positions: [[90, 370], [270, 370], [270, 230], [90, 230], [180, 105]],
    aretes: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [3, 4], [2, 4]],
    explication: [
      'Chaque passage par un sommet consomme deux arêtes : une pour entrer, une pour sortir. Seuls le départ et l’arrivée peuvent donc avoir un degré impair.',
      'Ici, les deux coins du bas sont de degré 3 : il faut partir de l’un et terminer sur l’autre.',
    ],
  },
  {
    id: 'konigsberg',
    type: 'euler',
    titre: 'Les ponts de Königsberg',
    notion: 'Parité des degrés',
    enonce: 'Traversez les sept ponts une seule fois chacun. Si c’est impossible, dites-le.',
    libelleCoups: 'tentatives',
    seuils: [1, 3],
    possible: false,
    decor: 'riviere',
    etiquettes: ['N', 'S', 'K', 'E'],
    positions: [[165, 80], [165, 395], [130, 238], [300, 238]],
    aretes: [[0, 2], [0, 2], [1, 2], [1, 2], [0, 3], [1, 3], [2, 3]],
    explication: [
      'Un chemin qui emprunte chaque arête une seule fois est dit eulérien. Euler a prouvé en 1736 qu’un graphe connexe en possède un si et seulement s’il a 0 ou 2 sommets de degré impair.',
      'À Königsberg, les quatre quartiers ont un degré impair (3, 3, 5 et 3) : la promenade est impossible. C’est l’acte de naissance de la théorie des graphes.',
    ],
  },
  {
    id: 'couleurs',
    type: 'coloration',
    titre: 'Trois couleurs',
    notion: 'Nombre chromatique',
    enonce: 'Coloriez chaque sommet avec l’une des 3 couleurs, sans que deux voisins se ressemblent.',
    libelleCoups: 'coups de pinceau',
    seuils: [9, 13],
    k: 3,
    positions: [
      [180, 70], [85, 150], [275, 150], [180, 200], [50, 300],
      [310, 300], [125, 315], [235, 315], [180, 410],
    ],
    aretes: [
      [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [1, 4], [3, 6], [3, 7],
      [2, 5], [4, 6], [6, 7], [7, 5], [6, 8], [7, 8], [1, 6], [5, 8],
    ],
    explication: [
      'Le nombre chromatique χ(G) est le plus petit nombre de couleurs qui permet de colorier les sommets sans que deux voisins partagent la même.',
      'Ce graphe contient des triangles, donc χ(G) ≥ 3, et vous venez de montrer que 3 couleurs suffisent. Le théorème des quatre couleurs affirme que toute carte plane se colorie avec 4 couleurs au plus.',
    ],
  },
  {
    id: 'camps',
    type: 'biparti',
    titre: 'Deux camps',
    notion: 'Graphe biparti',
    enonce: 'Touchez les sommets pour les répartir en deux camps : chaque arête doit relier les deux camps.',
    libelleCoups: 'touches',
    seuils: [8, 12],
    positions: positionsCube,
    aretes: cube,
    explication: [
      'Un graphe est biparti si ses sommets se répartissent en deux camps, chaque arête reliant un camp à l’autre. C’est le cas si et seulement s’il ne contient aucun cycle de longueur impaire.',
      'Ce graphe est le cube : ses sommets sont les mots de 3 bits, et le camp de chacun dépend de la parité de son nombre de 1.',
    ],
  },
  {
    id: 'dijkstra',
    type: 'dijkstra',
    titre: 'Le plus court chemin',
    notion: 'Algorithme de Dijkstra',
    enonce: 'Allez de S à T en touchant les sommets un à un. Le trajet doit être le moins coûteux.',
    libelleCoups: 'trajets refusés',
    seuils: [0, 1],
    source: 0,
    cible: 7,
    etiquettes: ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'T'],
    positions: [
      [45, 235], [130, 110], [130, 235], [130, 360],
      [235, 110], [235, 235], [235, 360], [320, 235],
    ],
    aretes: [
      [0, 1, 2], [0, 2, 6], [0, 3, 3], [1, 4, 7], [1, 2, 3], [2, 5, 2], [3, 6, 2],
      [3, 2, 2], [4, 7, 2], [5, 7, 6], [6, 5, 1], [6, 7, 7], [4, 5, 2],
    ],
    explication: [
      'L’algorithme de Dijkstra fixe les sommets un par un, toujours le plus proche de la source parmi ceux qui restent, puis met à jour les distances provisoires de ses voisins.',
      'Il trouve le plus court chemin dès que les poids sont positifs. C’est le principe des calculateurs d’itinéraire.',
    ],
  },
  {
    id: 'hamilton',
    type: 'hamilton',
    titre: 'Le tour complet',
    notion: 'Chemin hamiltonien',
    enonce: 'Visitez chaque sommet exactement une fois en suivant les arêtes.',
    libelleCoups: 'retours en arrière',
    seuils: [0, 4],
    positions: positionsPetersen,
    aretes: petersen,
    explication: [
      'Un chemin hamiltonien passe une et une seule fois par chaque sommet. Contrairement au cas eulérien, on ne connaît aucun critère simple pour décider s’il en existe un : le problème est NP-complet.',
      'Ce graphe, le graphe de Petersen, admet un chemin hamiltonien, mais aucun cycle hamiltonien.',
    ],
  },
  {
    id: 'isomorphisme',
    type: 'isomorphisme',
    titre: 'Même forme',
    notion: 'Isomorphisme',
    enonce: 'Faites glisser les sommets pour échanger leurs places, jusqu’à recouvrir la silhouette.',
    libelleCoups: 'échanges',
    seuils: [3, 6],
    positions: positionsPrisme,
    aretes: prisme,
    cible: prisme,
    depart: [2, 4, 1, 3, 0, 5],
    explication: [
      'Deux graphes sont isomorphes lorsqu’une bijection entre leurs sommets préserve exactement les arêtes : les dessins diffèrent, la structure est la même.',
      'Cette idée d’une correspondance qui préserve la structure reviendra sur l’Île Algébrique, avec les morphismes de groupes.',
    ],
  },
];

export function etoilesPour(n: Niveau, coups: number): number {
  if (coups <= n.seuils[0]) return 3;
  if (coups <= n.seuils[1]) return 2;
  return 1;
}
