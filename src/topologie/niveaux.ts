import type { NiveauFamille } from '../famille';
import type { Relief } from '../maths/ensembles';
import type { FicheNiveau } from '../partie';

export type Trait = [number, number][];
export interface Lettre { nom: string; traits: Trait[]; famille: number }

export type NiveauTopologie =
  | NiveauFamille
  | (FicheNiveau & { type: 'voisinage'; relief: Relief; manches: { genre: 'ouvert' | 'ferme'; requis: number[] }[] })
  | (FicheNiveau & { type: 'adherence'; relief: Relief; partie: number[] })
  | (FicheNiveau & { type: 'coupure'; manches: { nom: string; relief: Relief }[] })
  | (FicheNiveau & { type: 'lettres'; modeles: Lettre[]; lettres: Lettre[] })
  | (FicheNiveau & { type: 'continuite'; depart: Relief; arrivee: Relief; imposes: [number, number][] });

/** Droite de Khalimsky à k points : les points pairs sont en bas, les impairs en haut. */
export function droite(k: number, y0 = 300, y1 = 170, x0 = 40, x1 = 320): Relief {
  const points: [number, number][] = Array.from({ length: k }, (_, i) => [x0 + ((x1 - x0) * i) / (k - 1), i % 2 ? y1 : y0]);
  const liens: [number, number][] = [];
  for (let i = 1; i < k; i += 2) {
    liens.push([i - 1, i]);
    if (i + 1 < k) liens.push([i + 1, i]);
  }
  return { points, liens, noms: points.map((_, i) => String(i + 1)) };
}

/** Cercle fini à 2m points, alternativement bas et haut. */
function cercle(k: number, cx = 180, cy = 230, r = 140): Relief {
  const points: [number, number][] = Array.from({ length: k }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / k;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const liens: [number, number][] = [];
  for (let i = 0; i < k; i += 2) liens.push([i, (i + 1) % k], [i, (i + k - 1) % k]);
  return { points, liens, noms: points.map((_, i) => String(i + 1)) };
}

const HUIT: Relief = {
  points: [[180, 230], [110, 140], [40, 230], [110, 320], [250, 140], [320, 230], [250, 320]],
  liens: [[0, 1], [2, 1], [2, 3], [0, 3], [0, 4], [5, 4], [5, 6], [0, 6]],
  noms: ['1', '2', '3', '4', '5', '6', '7'],
};

/* Lettres tracées sur une boîte 60 × 80. */
function arc(cx: number, cy: number, rx: number, ry: number, de: number, a: number, pas = 14): Trait {
  return Array.from({ length: pas + 1 }, (_, i) => {
    const t = ((de + ((a - de) * i) / pas) * Math.PI) / 180;
    return [Math.round((cx + rx * Math.cos(t)) * 10) / 10, Math.round((cy + ry * Math.sin(t)) * 10) / 10];
  });
}
const L = (nom: string, famille: number, ...traits: Trait[]): Lettre => ({ nom, famille, traits });

export const MODELES: Lettre[] = [
  L('I', 0, [[30, 5], [30, 75]]),
  L('O', 1, [...arc(30, 40, 24, 35, -90, 270, 28)]),
  L('T', 2, [[6, 5], [30, 5], [54, 5]], [[30, 5], [30, 75]]),
  L('X', 3, [[8, 5], [30, 40], [52, 75]], [[52, 5], [30, 40], [8, 75]]),
];

const D: Trait = [[12, 5], [12, 75], ...arc(12, 40, 38, 35, 90, -90, 16).slice(1)];
D[D.length - 1] = [12, 5];
const O = MODELES[1].traits[0];
O[O.length - 1] = O[0];

export const LETTRES: Lettre[] = [
  L('C', 0, arc(34, 40, 26, 35, 45, 315, 20)),
  L('Y', 2, [[8, 5], [30, 40]], [[52, 5], [30, 40]], [[30, 40], [30, 75]]),
  L('D', 1, D),
  L('K', 3, [[12, 5], [12, 40], [12, 75]], [[50, 5], [12, 40], [50, 75]]),
  L('L', 0, [[12, 5], [12, 75], [50, 75]]),
  L('E', 2, [[50, 5], [12, 5], [12, 40], [12, 75], [50, 75]], [[12, 40], [42, 40]]),
  L('S', 0, [[49, 14], [40, 6], [22, 5], [12, 13], [12, 25], [22, 34], [38, 44], [49, 54], [49, 66], [39, 75], [20, 75], [10, 67]]),
  L('F', 2, [[50, 5], [12, 5], [12, 40], [12, 75]], [[12, 40], [42, 40]]),
  L('Z', 0, [[10, 5], [50, 5], [10, 75], [50, 75]]),
  L('U', 0, [[10, 5], [10, 52], ...arc(30, 52, 20, 22, 180, 0, 12).slice(1), [50, 5]]),
];

const LIGNE7 = droite(7);

export const NIVEAUX_TOPOLOGIE: NiveauTopologie[] = [
  {
    id: 'top-ouverts',
    type: 'famille',
    mode: 'topologie',
    titre: 'Les ouverts',
    notion: 'Topologie',
    enonce: 'Ajoutez des parties jusqu’à obtenir une topologie : la famille doit être stable par réunion et par intersection.',
    libelleCoups: 'touches',
    seuils: [4, 7],
    n: 4,
    lettres: ['a', 'b', 'c', 'd'],
    nomPlein: 'X',
    graines: [0b0011, 0b0110, 0b1100],
    explication: [
      'Une topologie sur X est une famille de parties, les ouverts, qui contient ∅ et X et qui est stable par réunion quelconque et par intersection finie.',
      'Les trois ouverts de départ en imposent quatre autres : vous avez construit la topologie qu’ils engendrent, la plus petite qui les contienne. Elle compte neuf ouverts sur les seize parties de X.',
    ],
  },
  {
    id: 'top-relief',
    type: 'voisinage',
    titre: 'Le relief',
    notion: 'Ouverts d’un espace fini',
    enonce: 'Ici, un ensemble est ouvert s’il contient, avec chaque point, les sommets juste au-dessus. Il est fermé s’il contient ceux juste en dessous.',
    libelleCoups: 'touches',
    seuils: [7, 11],
    relief: LIGNE7,
    manches: [
      { genre: 'ouvert', requis: [4] },
      { genre: 'ouvert', requis: [2, 6] },
      { genre: 'ferme', requis: [3] },
    ],
    explication: [
      'Sur un ensemble fini, une topologie se dessine comme un relief : chaque point a un plus petit ouvert qui le contient, formé de lui-même et des sommets au-dessus.',
      'Cette ligne en dents de scie est la droite de Khalimsky, utilisée en traitement d’images pour parler de continuité sur une grille de pixels. Les fermés sont les complémentaires des ouverts : ils descendent au lieu de monter.',
    ],
  },
  {
    id: 'top-adherence',
    type: 'adherence',
    titre: 'Bords et intérieur',
    notion: 'Adhérence, intérieur, frontière',
    enonce: 'La partie A est cerclée. Sélectionnez son adhérence, puis son intérieur, puis sa frontière, et validez.',
    libelleCoups: 'erreurs',
    seuils: [0, 2],
    relief: LIGNE7,
    partie: [2, 3, 5, 6],
    explication: [
      'L’adhérence de A est le plus petit fermé qui contient A ; son intérieur est le plus grand ouvert contenu dans A. La frontière est ce qui reste : l’adhérence privée de l’intérieur.',
      'Ici, la frontière de A = {3, 4, 6, 7} est {3, 5} : le point 5 n’est pas dans A mais il en est infiniment proche, puisque tout ouvert qui contient 5 contient aussi 6.',
    ],
  },
  {
    id: 'top-coupure',
    type: 'coupure',
    titre: 'Couper en deux',
    notion: 'Connexité',
    enonce: 'Retirez le moins de points possible pour que l’espace se sépare en au moins deux morceaux.',
    libelleCoups: 'points retirés',
    seuils: [4, 6],
    manches: [
      { nom: 'Une ligne', relief: LIGNE7 },
      { nom: 'Un cercle', relief: cercle(8) },
      { nom: 'Un huit', relief: HUIT },
    ],
    explication: [
      'Un espace est connexe s’il ne se coupe pas en deux ouverts disjoints non vides. Ces espaces finis se comportent comme leurs modèles : un point suffit à couper une ligne, il en faut deux pour un cercle.',
      'Le huit, lui, se coupe en retirant un seul point bien choisi, son centre. Compter les points de coupure est une façon de prouver que deux espaces ne sont pas homéomorphes.',
    ],
  },
  {
    id: 'top-lettres',
    type: 'lettres',
    titre: 'Déformer les lettres',
    notion: 'Homéomorphisme',
    enonce: 'Rangez chaque lettre avec le modèle en lequel on peut la déformer, sans couper ni coller.',
    libelleCoups: 'erreurs',
    seuils: [0, 2],
    modeles: MODELES,
    lettres: LETTRES,
    explication: [
      'Deux figures sont homéomorphes s’il existe une bijection continue de l’une sur l’autre, dont la réciproque est continue : on peut étirer et plier, mais ni couper ni recoller.',
      'Le nombre de bouts libres, d’embranchements et de boucles ne change pas sous une telle déformation. C’est pourquoi E et T sont pareils, et K et X aussi, alors que T et X diffèrent.',
    ],
  },
  {
    id: 'top-continuite',
    type: 'continuite',
    titre: 'Faire le tour',
    notion: 'Application continue',
    enonce: 'Envoyez chaque point de la ligne sur le cercle. L’application doit être continue et atteindre tous les points du cercle.',
    libelleCoups: 'affectations',
    seuils: [3, 6],
    depart: droite(5, 140, 66, 60, 300),
    arrivee: {
      points: [[80, 340], [180, 252], [280, 340], [180, 428]],
      liens: [[0, 1], [2, 1], [2, 3], [0, 3]],
      noms: ['a', 'b', 'c', 'd'],
    },
    imposes: [[0, 0], [4, 0]],
    explication: [
      'Entre espaces finis, une application est continue exactement quand elle respecte le relief : si y est au-dessus de x, f(y) est au-dessus de f(x), ou égal.',
      'Votre application part de a et y revient après avoir fait le tour. Ce cercle à quatre points a le même groupe fondamental que le vrai cercle (McCord, 1966), et votre lacet en fait le tour une fois.',
    ],
  },
];
