// Groupe diédral D_n : l'élément [k, f] désigne r^k s^f, où r est la rotation d'un n-ième de tour
// et s la symétrie d'axe vertical. Loi : r^a s^f · r^b s^g = r^(a + (−1)^f b) s^(f+g).

export type Sym = [number, number];

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export function compose(n: number, [a, f]: Sym, [b, g]: Sym): Sym {
  return [mod(a + (f ? -b : b), n), (f + g) % 2];
}
export const egal = (x: Sym, y: Sym) => x[0] === y[0] && x[1] === y[1];
export const neutre: Sym = [0, 0];
export const R: Sym = [1, 0];
export const S: Sym = [0, 1];
export const indice = (n: number, [k, f]: Sym) => f * n + k;
export const elementDe = (n: number, i: number): Sym => [i % n, Math.floor(i / n)];
export const tous = (n: number): Sym[] => Array.from({ length: 2 * n }, (_, i) => elementDe(n, i));

const EXPOSANTS = ['', '', '²', '³', '⁴', '⁵'];
export function nomSym([k, f]: Sym): string {
  if (!k && !f) return 'e';
  return (k ? 'r' + EXPOSANTS[k] : '') + (f ? 's' : '');
}

/** Matrice [a, b, c, d] (x' = a x + c y, y' = b x + d y) en coordonnées écran (y vers le bas). */
export function matrice(n: number, [k, f]: Sym): [number, number, number, number] {
  const t = (2 * Math.PI * k) / n;
  const c = Math.cos(t), s = Math.sin(t);
  // rotation R(t) puis, si f, symétrie x ↦ −x appliquée d'abord : R · S
  return f ? [-c, -s, -s, c] : [c, s, -s, c];
}

/** Distance minimale depuis e en composant à gauche par les générateurs donnés. */
export function distances(n: number, generateurs: Sym[]): number[] {
  const d = new Array(2 * n).fill(-1);
  d[0] = 0;
  const file: Sym[] = [neutre];
  while (file.length) {
    const x = file.shift()!;
    for (const g of generateurs) {
      const y = compose(n, g, x);
      if (d[indice(n, y)] < 0) {
        d[indice(n, y)] = d[indice(n, x)] + 1;
        file.push(y);
      }
    }
  }
  return d;
}

/** Une partie d'un groupe fini est un sous-groupe si elle est non vide et stable par composition. */
export function premierProduitSortant(n: number, partie: Sym[]): [Sym, Sym, Sym] | null {
  for (const x of partie) for (const y of partie) {
    const z = compose(n, x, y);
    if (!partie.some((p) => egal(p, z))) return [x, y, z];
  }
  return null;
}

/** Loi donnée par une table : t[a][b] = a ⋆ b. */
export function premierTripletNonAssociatif(t: number[][]): [number, number, number] | null {
  const n = t.length;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++)
    if (t[t[a][b]][c] !== t[a][t[b][c]]) return [a, b, c];
  return null;
}
