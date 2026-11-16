// Parties d'un ensemble fini à n éléments, codées par des masques de bits.

export const plein = (n: number) => (1 << n) - 1;
export const cardinal = (a: number) => { let c = 0; for (; a; a &= a - 1) c++; return c; };
export const elements = (a: number, n: number) => Array.from({ length: n }, (_, i) => i).filter((i) => a & (1 << i));
export const depuis = (indices: number[]) => indices.reduce((m, i) => m | (1 << i), 0);

export function nomPartie(a: number, n: number, lettres: string[], nomPlein?: string): string {
  if (a === 0) return '∅';
  if (nomPlein && a === plein(n)) return nomPlein;
  return `{${elements(a, n).map((i) => lettres[i]).join(', ')}}`;
}

export type Defaut =
  | { genre: 'vide' | 'plein' }
  | { genre: 'union' | 'inter'; a: number; b: number; r: number }
  | { genre: 'complement'; a: number; r: number };

/** Premier axiome de topologie mis en défaut, ou null si la famille est une topologie. */
export function defautTopologie(f: Set<number>, n: number): Defaut | null {
  if (!f.has(0)) return { genre: 'vide' };
  if (!f.has(plein(n))) return { genre: 'plein' };
  const l = [...f].sort((x, y) => cardinal(x) - cardinal(y) || x - y);
  for (const a of l) for (const b of l) {
    if (a >= b) continue;
    if (!f.has(a & b)) return { genre: 'inter', a, b, r: a & b };
    if (!f.has(a | b)) return { genre: 'union', a, b, r: a | b };
  }
  return null;
}

/** Premier axiome de tribu mis en défaut (complémentaire d'abord, puis réunion). */
export function defautTribu(f: Set<number>, n: number): Defaut | null {
  const p = plein(n);
  if (!f.has(0)) return { genre: 'vide' };
  const l = [...f].sort((x, y) => cardinal(x) - cardinal(y) || x - y);
  for (const a of l) if (!f.has(p & ~a)) return { genre: 'complement', a, r: p & ~a };
  for (const a of l) for (const b of l) if (a < b && !f.has(a | b)) return { genre: 'union', a, b, r: a | b };
  return null;
}

function fermeture(graines: number[], n: number, ops: ((a: number, b: number) => number)[], unaire?: (a: number) => number): Set<number> {
  const f = new Set<number>([0, plein(n), ...graines]);
  let change = true;
  while (change) {
    change = false;
    const l = [...f];
    for (const a of l) {
      if (unaire && !f.has(unaire(a))) { f.add(unaire(a)); change = true; }
      for (const b of l) for (const op of ops) {
        const r = op(a, b);
        if (!f.has(r)) { f.add(r); change = true; }
      }
    }
  }
  return f;
}

export const topologieEngendree = (graines: number[], n: number) =>
  fermeture(graines, n, [(a, b) => a & b, (a, b) => a | b]);

export const tribuEngendree = (graines: number[], n: number) =>
  fermeture(graines, n, [(a, b) => a | b], (a) => plein(n) & ~a);

/** Atomes d'une tribu finie : les plus petits éléments non vides. */
export function atomes(tribu: Set<number>): number[] {
  const l = [...tribu].filter((a) => a);
  return l.filter((a) => !l.some((b) => b !== a && (b & a) === b));
}

/** Partition engendrée par des événements : deux points sont dans le même atome s'ils appartiennent aux mêmes événements. */
export function partitionEngendree(evenements: number[], n: number): number[] {
  const cle = (i: number) => evenements.map((e) => (e >> i) & 1).join('');
  const groupes = new Map<string, number>();
  for (let i = 0; i < n; i++) groupes.set(cle(i), (groupes.get(cle(i)) ?? 0) | (1 << i));
  return [...groupes.values()];
}

/* Espaces finis dessinés comme des reliefs : les sommets « hauts » sont des points ouverts.
   Un ensemble est ouvert s'il contient, avec chaque point, tous les points situés au-dessus. */
export interface Relief {
  points: [number, number][];
  /** Paires [bas, haut] du diagramme. */
  liens: [number, number][];
  noms?: string[];
}

export const dessus = (r: Relief, x: number) => r.liens.filter(([b]) => b === x).map(([, h]) => h);
export const dessous = (r: Relief, x: number) => r.liens.filter(([, h]) => h === x).map(([b]) => b);

/** Plus petit ouvert contenant A (clôture vers le haut). */
export function ouvertEngendre(r: Relief, a: number): number {
  let m = a;
  for (let k = 0; k < r.points.length; k++) for (const [b, h] of r.liens) if (m & (1 << b)) m |= 1 << h;
  return m;
}
/** Adhérence : clôture vers le bas. */
export function adherence(r: Relief, a: number): number {
  let m = a;
  for (let k = 0; k < r.points.length; k++) for (const [b, h] of r.liens) if (m & (1 << h)) m |= 1 << b;
  return m;
}
export const estOuvert = (r: Relief, a: number) => ouvertEngendre(r, a) === a;
export const estFerme = (r: Relief, a: number) => adherence(r, a) === a;
export function interieur(r: Relief, a: number): number {
  let m = 0;
  for (let x = 0; x < r.points.length; x++) if (a & (1 << x) && (ouvertEngendre(r, 1 << x) & ~a) === 0) m |= 1 << x;
  return m;
}
export const frontiere = (r: Relief, a: number) => adherence(r, a) & ~interieur(r, a);

/** Composantes connexes du sous-espace formé par les points de `garde` (reliefs de hauteur 1). */
export function composantesRelief(r: Relief, garde: number): number[] {
  const n = r.points.length;
  const comp = new Array(n).fill(-1);
  let k = 0;
  const res: number[] = [];
  for (let s = 0; s < n; s++) {
    if (!(garde & (1 << s)) || comp[s] >= 0) continue;
    let m = 0;
    const pile = [s];
    comp[s] = k;
    while (pile.length) {
      const u = pile.pop()!;
      m |= 1 << u;
      for (const [b, h] of r.liens) {
        const v = b === u ? h : h === u ? b : -1;
        if (v >= 0 && garde & (1 << v) && comp[v] < 0) { comp[v] = k; pile.push(v); }
      }
    }
    res.push(m);
    k++;
  }
  return res;
}

/** x ≤ y dans l'ordre de spécialisation : y est au-dessus de x (ou égal). */
export const sous = (r: Relief, x: number, y: number) => x === y || (ouvertEngendre(r, 1 << x) & (1 << y)) !== 0;
