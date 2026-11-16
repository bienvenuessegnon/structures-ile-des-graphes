import type { Sym } from '../maths/groupes';
import type { FicheNiveau } from '../partie';

export type NiveauAlgebre =
  | (FicheNiveau & { type: 'symetries'; n: number; cibles: Sym[] })
  | (FicheNiveau & { type: 'horloge'; n: number })
  | (FicheNiveau & { type: 'cayley'; n: number; donnees: [number, number][] })
  | (FicheNiveau & { type: 'sousgroupe'; n: number; impose: Sym; taille: number })
  | (FicheNiveau & { type: 'associativite'; table: number[][] })
  | (FicheNiveau & { type: 'graphecayley'; n: number });

export const NIVEAUX_ALGEBRE: NiveauAlgebre[] = [
  {
    id: 'alg-triangle',
    type: 'symetries',
    titre: 'Le triangle tourne',
    notion: 'Groupe diédral D₃',
    enonce: 'Avec la rotation r et la symétrie s, amenez le triangle dans la position du modèle.',
    libelleCoups: 'mouvements',
    seuils: [6, 9],
    n: 3,
    cibles: [[2, 0], [1, 1], [2, 1]],
    explication: [
      'Un triangle équilatéral a exactement six symétries : trois rotations et trois réflexions. Composées entre elles, elles restent des symétries : elles forment un groupe, noté D₃.',
      'L’ordre compte : appliquer s puis r ne donne pas la même position que r puis s. D₃ est le plus petit groupe non commutatif.',
    ],
  },
  {
    id: 'alg-horloge',
    type: 'horloge',
    titre: 'L’horloge',
    notion: 'Groupe cyclique ℤ/12ℤ',
    enonce: 'Choisissez un saut en touchant une heure. Trouvez tous les sauts qui finissent par allumer les douze heures.',
    libelleCoups: 'sauts sans succès',
    seuils: [2, 5],
    n: 12,
    explication: [
      'Sur une horloge, on calcule modulo 12 : c’est le groupe ℤ/12ℤ. Un saut k parcourt un sous-groupe à 12 / pgcd(k, 12) éléments.',
      'Les douze heures s’allument exactement quand pgcd(k, 12) = 1 : 1, 5, 7 et 11 sont les générateurs du groupe. Il y en a φ(12) = 4, l’indicatrice d’Euler.',
    ],
  },
  {
    id: 'alg-table',
    type: 'cayley',
    titre: 'La table des quarts de tour',
    notion: 'Table de Cayley',
    enonce: 'Remplissez la table : chaque case reçoit la rotation obtenue en enchaînant celle de la ligne et celle de la colonne.',
    libelleCoups: 'cases posées',
    seuils: [8, 11],
    n: 4,
    // cases données : la ligne et la colonne du neutre, et 90° suivi de 90°
    donnees: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [2, 0], [3, 0], [1, 1]],
    explication: [
      'La table de Cayley d’un groupe donne tous les produits. Chaque élément apparaît une seule fois par ligne et par colonne : c’est un carré latin, car on peut toujours « diviser » dans un groupe.',
      'Les quatre rotations du carré forment ℤ/4ℤ : tourner de a quarts de tour puis de b, c’est tourner de a + b modulo 4.',
    ],
  },
  {
    id: 'alg-sousgroupe',
    type: 'sousgroupe',
    titre: 'Un groupe dans le groupe',
    notion: 'Sous-groupe',
    enonce: 'Parmi les huit symétries du carré, choisissez-en quatre, dont s, qui forment un groupe à elles seules.',
    libelleCoups: 'touches',
    seuils: [3, 6],
    n: 4,
    impose: [0, 1],
    taille: 4,
    explication: [
      'Une partie d’un groupe fini est un sous-groupe dès qu’elle est stable par composition : le neutre et les inverses viennent avec.',
      'Votre choix {e, r², s, r²s} est un sous-groupe d’ordre 4 de D₄, qui en a 8. Le théorème de Lagrange l’impose : l’ordre d’un sous-groupe divise l’ordre du groupe.',
    ],
  },
  {
    id: 'alg-associativite',
    type: 'associativite',
    titre: 'Presque un groupe',
    notion: 'Associativité',
    enonce: 'Cette loi a un neutre, 0, et chaque ligne est une permutation. Trouvez a, b, c tels que (a ⋆ b) ⋆ c ≠ a ⋆ (b ⋆ c).',
    libelleCoups: 'essais associatifs',
    seuils: [0, 2],
    table: [
      [0, 1, 2, 3, 4],
      [1, 0, 3, 4, 2],
      [2, 4, 0, 1, 3],
      [3, 2, 4, 0, 1],
      [4, 3, 1, 2, 0],
    ],
    explication: [
      'Une table qui est un carré latin avec un neutre définit une boucle. Ici chaque élément est même son propre inverse, et pourtant ce n’est pas un groupe : l’associativité manque.',
      'Un seul triplet suffit à le prouver. Cinq éléments est le minimum : toute boucle à quatre éléments ou moins est un groupe.',
    ],
  },
  {
    id: 'alg-graphe',
    type: 'graphecayley',
    titre: 'Le graphe du groupe',
    notion: 'Graphe de Cayley',
    enonce: 'Reliez chaque position à celle qu’on obtient en lui appliquant r (flèche) ou s (trait).',
    libelleCoups: 'liaisons refusées',
    seuils: [0, 3],
    n: 3,
    explication: [
      'Le graphe de Cayley représente un groupe : un sommet par élément, une arête par générateur appliqué. Un chemin du neutre à g écrit g comme un mot en r et s.',
      'Le graphe de D₃ est un prisme, celui du dernier niveau de l’Île des Graphes : deux triangles parcourus en sens contraires, reliés par les symétries.',
    ],
  },
];
