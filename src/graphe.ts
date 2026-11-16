// Algorithmes de base sur les graphes non orientés (multi-arêtes autorisées).

export type Arete = [number, number];
export type AretePonderee = [number, number, number];

export function adjacence(n: number, aretes: Arete[]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of aretes) {
    adj[u].push(v);
    adj[v].push(u);
  }
  return adj;
}

export function degres(n: number, aretes: Arete[]): number[] {
  const d = new Array(n).fill(0);
  for (const [u, v] of aretes) {
    d[u]++;
    d[v]++;
  }
  return d;
}

/** Étiquette de composante connexe pour chaque sommet. */
export function composantes(n: number, aretes: Arete[]): number[] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const trouver = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const [u, v] of aretes) parent[trouver(u)] = trouver(v);
  return parent.map((_, i) => trouver(i));
}

export function nombreComposantes(n: number, aretes: Arete[]): number {
  return new Set(composantes(n, aretes)).size;
}

export function estConnexe(n: number, aretes: Arete[]): boolean {
  return n <= 1 || nombreComposantes(n, aretes) === 1;
}

export function contientCycle(n: number, aretes: Arete[]): boolean {
  const parent = Array.from({ length: n }, (_, i) => i);
  const trouver = (x: number): number => (parent[x] === x ? x : (parent[x] = trouver(parent[x])));
  for (const [u, v] of aretes) {
    const a = trouver(u);
    const b = trouver(v);
    if (a === b) return true;
    parent[a] = b;
  }
  return false;
}

export interface BilanEuler {
  /** Sommets de degré impair. */
  impairs: number[];
  /** Les arêtes sont toutes dans une même composante. */
  aretesConnexes: boolean;
  cycle: boolean;
  chemin: boolean;
}

export function euler(n: number, aretes: Arete[]): BilanEuler {
  const d = degres(n, aretes);
  const impairs = d.map((x, i) => (x % 2 ? i : -1)).filter((i) => i >= 0);
  const comp = composantes(n, aretes);
  const touches = new Set<number>();
  for (let i = 0; i < n; i++) if (d[i] > 0) touches.add(comp[i]);
  const aretesConnexes = touches.size <= 1;
  const nonVide = aretes.length > 0;
  return {
    impairs,
    aretesConnexes,
    cycle: nonVide && aretesConnexes && impairs.length === 0,
    chemin: nonVide && aretesConnexes && (impairs.length === 0 || impairs.length === 2),
  };
}

/** 2-coloration par parcours en largeur ; null si le graphe n'est pas biparti. */
export function bipartition(n: number, aretes: Arete[]): number[] | null {
  const adj = adjacence(n, aretes);
  const camp = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (camp[s] !== -1) continue;
    camp[s] = 0;
    const file = [s];
    while (file.length) {
      const u = file.shift()!;
      for (const v of adj[u]) {
        if (v === u) return null;
        if (camp[v] === -1) {
          camp[v] = 1 - camp[u];
          file.push(v);
        } else if (camp[v] === camp[u]) return null;
      }
    }
  }
  return camp;
}

export function colorationValide(aretes: Arete[], couleurs: number[]): boolean {
  return couleurs.every((c) => c >= 0) && aretes.every(([u, v]) => couleurs[u] !== couleurs[v]);
}

/** Nombre chromatique par retour sur trace (petits graphes uniquement). */
export function nombreChromatique(n: number, aretes: Arete[]): number {
  const adj = adjacence(n, aretes);
  for (let k = 1; k <= n; k++) {
    const c = new Array(n).fill(-1);
    const essai = (i: number): boolean => {
      if (i === n) return true;
      for (let x = 0; x < k; x++) {
        if (adj[i].every((v) => c[v] !== x)) {
          c[i] = x;
          if (essai(i + 1)) return true;
          c[i] = -1;
        }
      }
      return false;
    };
    if (essai(0)) return k;
  }
  return n;
}

export interface EtapeDijkstra {
  sommet: number;
  distance: number;
  /** Distances provisoires après relâchement des voisins. */
  provisoires: number[];
}

export function dijkstra(n: number, aretes: AretePonderee[], source: number) {
  const adj: [number, number][][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of aretes) {
    adj[u].push([v, w]);
    adj[v].push([u, w]);
  }
  const dist = new Array(n).fill(Infinity);
  const prec = new Array(n).fill(-1);
  const fixe = new Array(n).fill(false);
  const etapes: EtapeDijkstra[] = [];
  dist[source] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!fixe[i] && (u === -1 || dist[i] < dist[u])) u = i;
    if (u === -1 || dist[u] === Infinity) break;
    fixe[u] = true;
    for (const [v, w] of adj[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prec[v] = u;
      }
    }
    etapes.push({ sommet: u, distance: dist[u], provisoires: dist.slice() });
  }
  return { dist, prec, etapes };
}

export function cheminDepuis(prec: number[], cible: number): number[] {
  const c: number[] = [];
  for (let x = cible; x !== -1; x = prec[x]) c.unshift(x);
  return c;
}

/** Un chemin hamiltonien (liste de sommets) ou null. */
export function cheminHamiltonien(n: number, aretes: Arete[], depart?: number): number[] | null {
  const adj = adjacence(n, aretes);
  const vu = new Array(n).fill(false);
  const chemin: number[] = [];
  const essai = (u: number): boolean => {
    vu[u] = true;
    chemin.push(u);
    if (chemin.length === n) return true;
    for (const v of adj[u]) if (!vu[v] && essai(v)) return true;
    vu[u] = false;
    chemin.pop();
    return false;
  };
  const departs = depart === undefined ? [...Array(n).keys()] : [depart];
  for (const s of departs) if (essai(s)) return chemin.slice();
  return null;
}

export function cleArete(u: number, v: number): string {
  return u < v ? `${u}-${v}` : `${v}-${u}`;
}

/** Vrai si l'image des arêtes par `place` coïncide exactement avec `cible`. */
export function superposition(aretes: Arete[], place: number[], cible: Arete[]): boolean {
  const attendu = new Set(cible.map(([u, v]) => cleArete(u, v)));
  const obtenu = new Set(aretes.map(([u, v]) => cleArete(place[u], place[v])));
  if (attendu.size !== obtenu.size) return false;
  for (const e of obtenu) if (!attendu.has(e)) return false;
  return true;
}
