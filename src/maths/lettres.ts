// Une lettre tracée comme un graphe : on fusionne les points confondus et on lit ses invariants topologiques.

export interface Signature {
  /** Points de degré 1 : les bouts libres. */
  bouts: [number, number][];
  /** Points de degré au moins 3, avec leur degré. */
  embranchements: [number, number, number][];
  /** Nombre de boucles indépendantes : arêtes − sommets + composantes. */
  boucles: number;
}

export function signature(traits: [number, number][][]): Signature {
  const cles = new Map<string, number>();
  const pts: [number, number][] = [];
  const id = ([x, y]: [number, number]) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (!cles.has(k)) { cles.set(k, pts.length); pts.push([x, y]); }
    return cles.get(k)!;
  };
  const aretes = new Set<string>();
  for (const t of traits) for (let i = 1; i < t.length; i++) {
    const a = id(t[i - 1]), b = id(t[i]);
    if (a !== b) aretes.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  const deg = new Array(pts.length).fill(0);
  const parent = pts.map((_, i) => i);
  const racine = (x: number): number => (parent[x] === x ? x : (parent[x] = racine(parent[x])));
  for (const e of aretes) {
    const [a, b] = e.split('-').map(Number);
    deg[a]++; deg[b]++;
    parent[racine(a)] = racine(b);
  }
  const comp = new Set(pts.map((_, i) => racine(i))).size;
  return {
    bouts: pts.filter((_, i) => deg[i] === 1),
    embranchements: pts.map((p, i) => [p[0], p[1], deg[i]] as [number, number, number]).filter((p) => p[2] >= 3),
    boucles: aretes.size - pts.length + comp,
  };
}

export const empreinte = (s: Signature) =>
  `${s.bouts.length}|${s.embranchements.map((e) => e[2]).sort().join(',')}|${s.boucles}`;
