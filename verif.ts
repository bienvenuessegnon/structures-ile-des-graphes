import { NIVEAUX } from './src/niveaux';
import * as G from './src/graphe';
let ok = true;
const check = (c: boolean, m: string) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + m); if (!c) ok = false; };
for (const n of NIVEAUX) {
  const N = n.positions.length;
  switch (n.type) {
    case 'arbre': {
      check(G.estConnexe(N, n.candidates), `${n.id}: candidates connexes`);
      check(n.seuils[0] === N - 1, `${n.id}: 3 étoiles = n−1 = ${N - 1}`);
      break;
    }
    case 'euler': {
      const b = G.euler(N, n.aretes);
      console.log(`     ${n.id}: degrés ${G.degres(N, n.aretes)} impairs ${b.impairs}`);
      check(b.chemin === n.possible, `${n.id}: chemin eulérien ${n.possible ? 'existe' : 'n’existe pas'}`);
      // vérification exhaustive par recherche
      const used = new Array(n.aretes.length).fill(false);
      const dfs = (u: number, k: number): boolean => {
        if (k === n.aretes.length) return true;
        for (let i = 0; i < n.aretes.length; i++) {
          if (used[i]) continue;
          const [a, c] = n.aretes[i];
          const v = a === u ? c : c === u ? a : -1;
          if (v < 0) continue;
          used[i] = true;
          if (dfs(v, k + 1)) return true;
          used[i] = false;
        }
        return false;
      };
      let trouve = false;
      for (let s = 0; s < N && !trouve; s++) trouve = dfs(s, 0);
      check(trouve === n.possible, `${n.id}: recherche exhaustive concorde`);
      break;
    }
    case 'coloration': {
      const chi = G.nombreChromatique(N, n.aretes);
      check(chi === n.k, `${n.id}: χ = ${chi} = k`);
      break;
    }
    case 'biparti':
      check(G.bipartition(N, n.aretes) !== null, `${n.id}: biparti`);
      break;
    case 'dijkstra': {
      const d = G.dijkstra(N, n.aretes, n.source);
      // force brute
      let best = Infinity, nb = 0;
      const adj = Array.from({ length: N }, () => [] as [number, number][]);
      for (const [u, v, w] of n.aretes) { adj[u].push([v, w]); adj[v].push([u, w]); }
      const vu = new Array(N).fill(false);
      const rec = (u: number, c: number) => {
        if (u === n.cible) { if (c < best) { best = c; nb = 1; } else if (c === best) nb++; return; }
        vu[u] = true;
        for (const [v, w] of adj[u]) if (!vu[v]) rec(v, c + w);
        vu[u] = false;
      };
      rec(n.source, 0);
      check(d.dist[n.cible] === best, `${n.id}: Dijkstra ${d.dist[n.cible]} = force brute ${best}`);
      check(nb === 1, `${n.id}: plus court chemin unique (${nb}) : ${G.cheminDepuis(d.prec, n.cible)}`);
      break;
    }
    case 'hamilton': {
      const c = G.cheminHamiltonien(N, n.aretes);
      check(c !== null, `${n.id}: chemin hamiltonien ${c}`);
      break;
    }
    case 'isomorphisme': {
      check(!G.superposition(n.aretes, n.depart, n.cible), `${n.id}: départ non résolu`);
      // BFS sur les échanges
      const key = (p: number[]) => p.join(',');
      const vus = new Map([[key(n.depart), 0]]);
      const file = [n.depart];
      let min = -1;
      while (file.length) {
        const p = file.shift()!; const d = vus.get(key(p))!;
        if (G.superposition(n.aretes, p, n.cible)) { min = d; break; }
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          const q = p.slice(); [q[i], q[j]] = [q[j], q[i]];
          if (!vus.has(key(q))) { vus.set(key(q), d + 1); file.push(q); }
        }
      }
      check(min > 0 && min <= n.seuils[0], `${n.id}: échanges minimaux ${min} ≤ seuil 3★ ${n.seuils[0]}`);
      break;
    }
  }
}
process.exit(ok ? 0 : 1);
