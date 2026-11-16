import { NIVEAUX_ALGEBRE } from './algebre/niveaux';
import { NIVEAUX } from './niveaux';
import type { FicheNiveau } from './partie';
import { NIVEAUX_TOPOLOGIE } from './topologie/niveaux';
import { NIVEAUX_TRIBUS } from './tribus/niveaux';
import { NIVEAUX_VECTORIEL } from './vectoriel/niveaux';

export interface Ile {
  id: string;
  nom: string;
  notions: string;
  niveaux: FicheNiveau[];
}

export const ILES: Ile[] = [
  { id: 'graphes', nom: 'Île des Graphes', notions: 'Arbres, parcours, couleurs, distances', niveaux: NIVEAUX },
  { id: 'algebre', nom: 'Île Algébrique', notions: 'Symétries, groupes, tables de Cayley', niveaux: NIVEAUX_ALGEBRE },
  { id: 'topologie', nom: 'Île Topologique', notions: 'Ouverts, adhérence, connexité, continuité', niveaux: NIVEAUX_TOPOLOGIE },
  { id: 'tribus', nom: 'Île des Tribus', notions: 'Tribus, atomes, mesure, probabilités', niveaux: NIVEAUX_TRIBUS },
  { id: 'vectoriel', nom: 'Île Vectorielle', notions: 'Bases, matrices, déterminant, valeurs propres', niveaux: NIVEAUX_VECTORIEL },
];

export const ile = (id: string) => ILES.find((i) => i.id === id);
export const totalNiveaux = ILES.reduce((s, i) => s + i.niveaux.length, 0);
