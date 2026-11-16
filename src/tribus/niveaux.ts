import type { NiveauFamille } from '../famille';
import type { FicheNiveau } from '../partie';

export interface Contrainte { nom: string; zones: number[]; valeur: number }

export type NiveauTribus =
  | NiveauFamille
  | (FicheNiveau & { type: 'atomes'; evenements: { nom: string; masque: number }[] })
  | (FicheNiveau & { type: 'mesurable'; valeurs: number[]; atomes: number[]; max: number })
  | (FicheNiveau & { type: 'masses'; contraintes: Contrainte[] })
  | (FicheNiveau & { type: 'independance'; cote: number; a: number[]; manches: { taille: number; possible: boolean }[] })
  | (FicheNiveau & { type: 'esperance'; masses: number[]; valeurs: number[]; atomes: number[] });

export const NIVEAUX_TRIBUS: NiveauTribus[] = [
  {
    id: 'tri-engendree',
    type: 'famille',
    mode: 'tribu',
    titre: 'La tribu engendrée',
    notion: 'Tribu',
    enonce: 'Ajoutez des parties jusqu’à obtenir une tribu : stable par complémentaire et par réunion.',
    libelleCoups: 'touches',
    seuils: [4, 7],
    n: 4,
    lettres: ['a', 'b', 'c', 'd'],
    nomPlein: 'Ω',
    graines: [0b0001, 0b0011],
    explication: [
      'Une tribu, ou σ-algèbre, sur Ω contient Ω et est stable par complémentaire et par réunion dénombrable. Sur un ensemble fini, les réunions finies suffisent.',
      'Contrairement à une topologie, une tribu contient le complémentaire de chacun de ses éléments. {a} et {a, b} engendrent ici 8 parties : toutes les réunions de {a}, {b} et {c, d}.',
    ],
  },
  {
    id: 'tri-atomes',
    type: 'atomes',
    titre: 'Ce que l’on sait',
    notion: 'Atomes d’une tribu',
    enonce: 'On sait seulement si le dé est pair (A) et s’il vaut au plus 3 (B). Coloriez de la même couleur les faces impossibles à distinguer.',
    libelleCoups: 'coups de pinceau',
    seuils: [6, 9],
    evenements: [
      { nom: 'A', masque: 0b101010 },
      { nom: 'B', masque: 0b000111 },
    ],
    explication: [
      'La tribu engendrée par A et B découpe Ω en atomes : deux faces sont dans le même atome quand aucun événement de la tribu ne les sépare. Ici : {2}, {4, 6}, {1, 3} et {5}.',
      'Toute tribu finie est faite des réunions de ses atomes. Avec 4 atomes, elle compte 2⁴ = 16 événements. Une tribu, c’est une information : ce que l’on peut savoir du résultat.',
    ],
  },
  {
    id: 'tri-mesurable',
    type: 'mesurable',
    titre: 'Une fonction aveugle',
    notion: 'Fonction mesurable',
    enonce: 'Faites glisser les barres pour rendre f mesurable : elle ne doit pas distinguer deux points d’une même bande. Modifiez le moins de barres possible.',
    libelleCoups: 'barres modifiées',
    seuils: [4, 6],
    valeurs: [2, 4, 2, 4, 5, 3, 1, 6, 1],
    atomes: [0b000001111, 0b000110000, 0b111000000],
    max: 6,
    explication: [
      'f est mesurable pour une tribu lorsque chaque événement {f = y} est dans la tribu. Sur un espace fini, cela revient à être constante sur chaque atome.',
      'Une fonction mesurable n’utilise que l’information contenue dans la tribu. En probabilités, on parle de variable aléatoire.',
    ],
  },
  {
    id: 'tri-masses',
    type: 'masses',
    titre: 'Répartir la masse',
    notion: 'Mesure additive',
    enonce: 'Déposez des grains dans les zones pour que la mesure de chaque ensemble ait la valeur affichée.',
    libelleCoups: 'gestes',
    seuils: [10, 14],
    contraintes: [
      { nom: 'μ(A)', zones: [0, 1], valeur: 5 },
      { nom: 'μ(B)', zones: [1, 2], valeur: 4 },
      { nom: 'μ(A ∪ B)', zones: [0, 1, 2], valeur: 7 },
      { nom: 'μ(Ω)', zones: [0, 1, 2, 3], valeur: 10 },
    ],
    explication: [
      'Une mesure est additive : la mesure d’une réunion disjointe est la somme des mesures. Il suffit donc de connaître la masse de chaque atome.',
      'D’où la formule d’inclusion-exclusion : μ(A ∩ B) = μ(A) + μ(B) − μ(A ∪ B) = 5 + 4 − 7 = 2. Divisée par μ(Ω), une mesure devient une probabilité.',
    ],
  },
  {
    id: 'tri-independance',
    type: 'independance',
    titre: 'Indépendants',
    notion: 'Indépendance',
    enonce: 'Chaque case a la même probabilité. Coloriez un événement B indépendant de A : P(A ∩ B) = P(A) · P(B).',
    libelleCoups: 'touches',
    seuils: [8, 12],
    cote: 4,
    a: [0, 4, 8, 12, 13, 14],
    manches: [
      { taille: 8, possible: true },
      { taille: 4, possible: false },
    ],
    explication: [
      'A et B sont indépendants quand savoir que B est réalisé ne change pas la probabilité de A : P(A | B) = P(A). Ici P(A) = 6/16 = 3/8.',
      'Avec P(B) = 1/4, il faudrait que A ∩ B contienne 16 × 3/8 × 1/4 = 1,5 case : c’est impossible. Sur un espace fini, l’indépendance dépend aussi de l’arithmétique.',
    ],
  },
  {
    id: 'tri-esperance',
    type: 'esperance',
    titre: 'Mettre à niveau',
    notion: 'Espérance conditionnelle',
    enonce: 'Les points ont des masses différentes (leur largeur). Réglez le niveau d’eau de chaque bande pour qu’il contienne autant que les barres.',
    libelleCoups: 'réglages',
    seuils: [3, 5],
    masses: [1, 2, 1, 1, 1, 2, 1, 1],
    valeurs: [5, 2, 3, 6, 2, 1, 4, 6],
    atomes: [0b00000111, 0b00011000, 0b11100000],
    explication: [
      'Sur chaque atome, le niveau d’eau est la moyenne de f pondérée par la mesure : c’est l’espérance conditionnelle E[f | 𝒯]. C’est la fonction mesurable la plus proche de f.',
      'L’eau ne se crée ni ne se perd : E[E[f | 𝒯]] = E[f]. Les deux ont la même intégrale, ici 3 × 4 + 4 × 2 + 3 × 4 = 32.',
    ],
  },
];
