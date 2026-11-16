import type { FicheNiveau } from '../partie';

export type V = [number, number];
/** Matrice par lignes : [[a, b], [c, d]] agit par (x, y) ↦ (a x + b y, c x + d y). */
export type M = [[number, number], [number, number]];

export type NiveauVectoriel =
  | (FicheNiveau & { type: 'combinaison'; u: V; v: V; cibles: V[] })
  | (FicheNiveau & { type: 'dependance'; vecteurs: V[] })
  | (FicheNiveau & { type: 'matrice'; forme: V[]; cibles: M[] })
  | (FicheNiveau & { type: 'determinant'; u: V; depart: V; cibles: number[] })
  | (FicheNiveau & { type: 'noyau'; m: M; manches: ({ genre: 'noyau' } | { genre: 'antecedent'; b: V })[] })
  | (FicheNiveau & { type: 'propres'; m: M; depart: V });

export const NIVEAUX_VECTORIEL: NiveauVectoriel[] = [
  {
    id: 'vec-combinaison',
    type: 'combinaison',
    titre: 'Pas à pas',
    notion: 'Combinaison linéaire',
    enonce: 'Rejoignez la cible en enchaînant les vecteurs u et v, ou leurs opposés.',
    libelleCoups: 'pas',
    seuils: [8, 12],
    u: [2, 1],
    v: [-1, 2],
    // coefficients (a, b) : la cible est a·u + b·v
    cibles: [[1, 1], [2, -1], [-1, 2]],
    explication: [
      'Chaque cible s’écrit a·u + b·v : c’est une combinaison linéaire de u et v. Peu importe l’ordre des pas, seul compte le nombre net de u et de v.',
      'Avec des coefficients réels, u et v atteignent tout le plan : ils en forment une base, et (a, b) sont les coordonnées de la cible dans cette base.',
    ],
  },
  {
    id: 'vec-dependance',
    type: 'dependance',
    titre: 'Revenir au départ',
    notion: 'Famille liée',
    enonce: 'Choisissez des coefficients a, b, c, pas tous nuls, pour que a·u + b·v + c·w ramène à l’origine.',
    libelleCoups: 'réglages',
    seuils: [4, 8],
    vecteurs: [[2, 1], [1, 3], [3, -1]],
    explication: [
      'Une relation a·u + b·v + c·w = 0 avec des coefficients non tous nuls signifie que la famille est liée : l’un des vecteurs s’exprime avec les autres. Ici w = 2u − v.',
      'Dans le plan, trois vecteurs sont toujours liés, car la dimension est 2 : une base du plan compte exactement deux vecteurs.',
    ],
  },
  {
    id: 'vec-matrice',
    type: 'matrice',
    titre: 'La grille se déforme',
    notion: 'Matrice d’une application linéaire',
    enonce: 'Déplacez les images de e₁ et e₂ pour que la figure recouvre sa silhouette transformée.',
    libelleCoups: 'déplacements',
    seuils: [5, 8],
    forme: [[0, 0], [1, 0], [1, 2], [2, 2], [2, 3], [0, 3]],
    cibles: [
      [[0, -1], [1, 0]],
      [[1, 1], [0, 1]],
      [[2, 0], [0, -1]],
    ],
    explication: [
      'Une application linéaire est entièrement déterminée par les images des vecteurs de base. Les colonnes de sa matrice sont justement ces images, f(e₁) et f(e₂).',
      'Vous avez réalisé un quart de tour, un cisaillement, puis un étirement suivi d’une symétrie. Les droites de la grille restent droites et parallèles : c’est la marque du linéaire.',
    ],
  },
  {
    id: 'vec-determinant',
    type: 'determinant',
    titre: 'Aire signée',
    notion: 'Déterminant',
    enonce: 'Déplacez la pointe de v pour que le parallélogramme construit sur u et v ait l’aire signée demandée.',
    libelleCoups: 'déplacements',
    seuils: [3, 6],
    u: [2, 1],
    depart: [0, 2],
    cibles: [5, -4, 0],
    explication: [
      'det(u, v) est l’aire du parallélogramme construit sur u et v, comptée négativement quand on tourne de u vers v dans le sens des aiguilles d’une montre.',
      'Il est nul exactement quand u et v sont colinéaires. Glisser v parallèlement à u ne change pas l’aire : le déterminant est linéaire en chaque vecteur.',
    ],
  },
  {
    id: 'vec-noyau',
    type: 'noyau',
    titre: 'Écrasé sur une droite',
    notion: 'Noyau et image',
    enonce: 'Cette matrice écrase le plan sur une droite. Déplacez x et observez son image M x.',
    libelleCoups: 'essais',
    seuils: [3, 6],
    m: [[1, 2], [2, 4]],
    manches: [
      { genre: 'noyau' },
      { genre: 'antecedent', b: [3, 6] },
      { genre: 'antecedent', b: [2, 1] },
    ],
    explication: [
      'Le noyau de M est l’ensemble des x tels que M x = 0 ; son image, l’ensemble des M x. Ici les deux sont des droites, et dim ker + dim im = 2 : c’est le théorème du rang.',
      'L’équation M x = b a une solution exactement quand b est dans l’image. Quand elle en a une, elle en a une infinité : on peut ajouter n’importe quel vecteur du noyau.',
    ],
  },
  {
    id: 'vec-propres',
    type: 'propres',
    titre: 'Les directions fixes',
    notion: 'Vecteurs propres',
    enonce: 'Déplacez x jusqu’à ce que M x soit sur la même droite que x. Trouvez les deux directions où cela arrive.',
    libelleCoups: 'déplacements',
    seuils: [2, 5],
    m: [[1, 2], [2, 1]],
    depart: [1, 0],
    explication: [
      'Un vecteur propre x vérifie M x = λ x : la matrice ne fait que l’étirer, d’un facteur λ, la valeur propre. Ici λ = 3 sur la diagonale et λ = −1 sur l’autre, où M retourne les vecteurs.',
      'Dans la base formée de ces deux directions, M devient diagonale : diag(3, −1). Les valeurs propres sont les racines de det(M − λI) = (1 − λ)² − 4.',
    ],
  },
];
