import { NIVEAUX } from './src/niveaux';
import * as G from './src/graphe';
import { NIVEAUX_ALGEBRE } from './src/algebre/niveaux';
import { NIVEAUX_TOPOLOGIE } from './src/topologie/niveaux';
import { NIVEAUX_TRIBUS } from './src/tribus/niveaux';
import { NIVEAUX_VECTORIEL, type V, type M } from './src/vectoriel/niveaux';
import type { NiveauFamille } from './src/famille';
import * as Gr from './src/maths/groupes';
import * as E from './src/maths/ensembles';
import { empreinte, signature } from './src/maths/lettres';
let ok = true;
const check = (c: boolean, m: string) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + m); if (!c) ok = false; };
const titre = (t: string) => console.log(`\n— ${t}`);
titre('Île des Graphes');
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

// Identifiants uniques sur tout l'archipel
{
  const ids = [NIVEAUX, NIVEAUX_ALGEBRE, NIVEAUX_TOPOLOGIE, NIVEAUX_TRIBUS, NIVEAUX_VECTORIEL].flat().map((n) => n.id);
  check(new Set(ids).size === ids.length, `${ids.length} niveaux, identifiants uniques`);
}

function famille(n: NiveauFamille) {
  const gen = n.mode === 'topologie' ? E.topologieEngendree(n.graines, n.n) : E.tribuEngendree(n.graines, n.n);
  const valide = n.mode === 'topologie' ? E.defautTopologie(gen, n.n) === null : E.defautTribu(gen, n.n) === null;
  check(valide, `${n.id}: la famille engendrée est une ${n.mode}`);
  const imposees = new Set([0, E.plein(n.n), ...n.graines]);
  console.log(`     ${n.id}: ${gen.size} parties : ${[...gen].sort((a, b) => a - b).map((m) => E.nomPartie(m, n.n, n.lettres, n.nomPlein)).join(' ')}`);
  check(gen.size - imposees.size === n.seuils[0], `${n.id}: ajouts minimaux ${gen.size - imposees.size} = seuil 3★`);
  // aucune famille plus petite : toute famille valide contenant les graines contient la famille engendrée
  let plusPetite = false;
  const libres = [...Array(1 << n.n).keys()].filter((m) => !imposees.has(m));
  for (let k = 0; k < 1 << libres.length; k++) {
    const f = new Set(imposees);
    libres.forEach((m, i) => k & (1 << i) && f.add(m));
    const v = n.mode === 'topologie' ? E.defautTopologie(f, n.n) === null : E.defautTribu(f, n.n) === null;
    if (v && [...gen].some((m) => !f.has(m))) plusPetite = true;
  }
  check(!plusPetite, `${n.id}: toute ${n.mode} contenant les graines contient la famille engendrée`);
}

titre('Île Algébrique');
for (const n of NIVEAUX_ALGEBRE) {
  switch (n.type) {
    case 'symetries': {
      const d = Gr.distances(n.n, [Gr.R, Gr.S]);
      const somme = n.cibles.reduce((s, c) => s + d[Gr.indice(n.n, c)], 0);
      check(n.cibles.every((c) => d[Gr.indice(n.n, c)] > 0), `${n.id}: aucune cible n’est la position de départ`);
      check(somme === n.seuils[0], `${n.id}: mouvements minimaux ${somme} = seuil 3★`);
      // la loi codée coïncide avec le produit des matrices
      let concorde = true;
      for (const x of Gr.tous(n.n)) for (const y of Gr.tous(n.n)) {
        const [a, b, c, dd] = Gr.matrice(n.n, x), [e, f, g, h] = Gr.matrice(n.n, y);
        const p = [a * e + c * f, b * e + dd * f, a * g + c * h, b * g + dd * h];
        const z = Gr.matrice(n.n, Gr.compose(n.n, x, y));
        if (p.some((v, i) => Math.abs(v - z[i]) > 1e-9)) concorde = false;
      }
      check(concorde, `${n.id}: loi de D${n.n} = produit des matrices`);
      break;
    }
    case 'horloge': {
      const pgcd = (a: number, b: number): number => (b ? pgcd(b, a % b) : a);
      const gens = [...Array(n.n).keys()].filter((k) => k && pgcd(k, n.n) === 1);
      check(gens.length === 4, `${n.id}: générateurs ${gens.join(', ')} (φ(12) = 4)`);
      break;
    }
    case 'cayley': {
      const N = n.n;
      const t = Array.from({ length: N }, () => new Array(N).fill(-1));
      for (const [i, j] of n.donnees) t[i][j] = (i + j) % N;
      const vides: [number, number][] = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (t[i][j] < 0) vides.push([i, j]);
      let solutions = 0;
      const rec = (k: number) => {
        if (k === vides.length) { solutions++; return; }
        const [i, j] = vides[k];
        for (let v = 0; v < N; v++) {
          if (t[i].includes(v) || t.some((l) => l[j] === v)) continue;
          t[i][j] = v; rec(k + 1); t[i][j] = -1;
        }
      };
      rec(0);
      check(solutions === 1, `${n.id}: une seule façon de compléter le carré latin (${solutions})`);
      check(vides.length === n.seuils[0], `${n.id}: ${vides.length} cases vides = seuil 3★`);
      break;
    }
    case 'sousgroupe': {
      const elts = Gr.tous(n.n);
      const trouves: string[] = [];
      for (let m = 0; m < 1 << elts.length; m++) {
        const p = elts.filter((_, i) => m & (1 << i));
        if (p.length !== n.taille || !p.some((x) => Gr.egal(x, n.impose))) continue;
        if (!Gr.premierProduitSortant(n.n, p)) trouves.push(p.map(Gr.nomSym).join(' '));
      }
      check(trouves.length === 1, `${n.id}: un seul sous-groupe d’ordre ${n.taille} contenant s : {${trouves.join(' | ')}}`);
      check(n.taille - 1 === n.seuils[0], `${n.id}: touches minimales ${n.taille - 1} = seuil 3★`);
      break;
    }
    case 'associativite': {
      const T = n.table, N = T.length;
      const latin = T.every((l) => new Set(l).size === N) && T.every((_, j) => new Set(T.map((l) => l[j])).size === N);
      check(latin, `${n.id}: carré latin`);
      check(T[0].every((v, j) => v === j) && T.every((l, i) => l[0] === i), `${n.id}: 0 est neutre`);
      let mauvais = 0;
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) for (let c = 0; c < N; c++) if (T[T[a][b]][c] !== T[a][T[b][c]]) mauvais++;
      check(mauvais > 0, `${n.id}: non associative (${mauvais} triplets témoins sur ${N ** 3})`);
      break;
    }
    case 'graphecayley': {
      const aretes = new Set<string>();
      for (const g of Gr.tous(n.n)) for (const s of [Gr.R, Gr.S]) {
        const h = Gr.compose(n.n, s, g);
        const [a, b] = [Gr.indice(n.n, g), Gr.indice(n.n, h)];
        aretes.add(Gr.egal(s, Gr.S) ? `s${Math.min(a, b)}-${Math.max(a, b)}` : `r${a}-${b}`);
      }
      check(aretes.size === 3 * n.n, `${n.id}: ${aretes.size} liens (${2 * n.n} flèches r, ${n.n} traits s)`);
      const nonOrientees: G.Arete[] = [...aretes].map((k) => k.slice(1).split('-').map(Number) as G.Arete);
      check(G.degres(2 * n.n, nonOrientees).every((d) => d === 3), `${n.id}: graphe 3-régulier, un prisme`);
      break;
    }
  }
}

titre('Île Topologique');
for (const n of NIVEAUX_TOPOLOGIE) {
  switch (n.type) {
    case 'famille': famille(n); break;
    case 'voisinage': {
      let total = 0;
      for (const m of n.manches) {
        const req = E.depuis(m.requis);
        const cible = m.genre === 'ouvert' ? E.ouvertEngendre(n.relief, req) : E.adherence(n.relief, req);
        check(m.genre === 'ouvert' ? E.estOuvert(n.relief, cible) : E.estFerme(n.relief, cible), `${n.id}: plus petit ${m.genre === 'ouvert' ? 'ouvert' : 'fermé'} contenant ${m.requis.map((i) => i + 1)} = {${E.elements(cible, 7).map((i) => i + 1)}}`);
        total += E.cardinal(cible) - E.cardinal(req);
      }
      check(total === n.seuils[0], `${n.id}: touches minimales ${total} = seuil 3★`);
      break;
    }
    case 'adherence': {
      const A = E.depuis(n.partie), r = n.relief;
      const f = (m: number) => `{${E.elements(m, r.points.length).map((i) => i + 1)}}`;
      console.log(`     ${n.id}: A = ${f(A)}, adhérence ${f(E.adherence(r, A))}, intérieur ${f(E.interieur(r, A))}, frontière ${f(E.frontiere(r, A))}`);
      check(E.frontiere(r, A) === E.depuis([2, 4]), `${n.id}: frontière = {3, 5}, comme dans l’explication`);
      // l'intérieur est le plus grand ouvert contenu dans A
      let plusGrand = 0;
      for (let m = 0; m < 1 << r.points.length; m++) if ((m & ~A) === 0 && E.estOuvert(r, m) && E.cardinal(m) > E.cardinal(plusGrand)) plusGrand = m;
      check(plusGrand === E.interieur(r, A), `${n.id}: intérieur = plus grand ouvert inclus dans A`);
      break;
    }
    case 'coupure': {
      let total = 0;
      for (const m of n.manches) {
        const k = m.relief.points.length;
        let min = Infinity, nb = 0;
        for (let ret = 0; ret < 1 << k; ret++) {
          if (E.composantesRelief(m.relief, E.plein(k) & ~ret).length < 2) continue;
          const c = E.cardinal(ret);
          if (c < min) { min = c; nb = 1; } else if (c === min) nb++;
        }
        console.log(`     ${n.id}: ${m.nom} : ${min} point(s) à retirer, ${nb} façon(s)`);
        total += min;
      }
      check(total === n.seuils[0], `${n.id}: retraits minimaux ${total} = seuil 3★`);
      break;
    }
    case 'lettres': {
      const modeles = n.modeles.map((m) => empreinte(signature(m.traits)));
      check(new Set(modeles).size === modeles.length, `${n.id}: modèles deux à deux non homéomorphes (${modeles.join(' / ')})`);
      for (const l of n.lettres) check(empreinte(signature(l.traits)) === modeles[l.famille], `${n.id}: ${l.nom} ~ ${n.modeles[l.famille].nom} (${empreinte(signature(l.traits))})`);
      break;
    }
    case 'continuite': {
      const X = n.depart, Y = n.arrivee;
      const libres = X.points.map((_, i) => i).filter((i) => !n.imposes.some(([a]) => a === i));
      const sols: string[] = [];
      const f = X.points.map(() => -1);
      for (const [a, b] of n.imposes) f[a] = b;
      const rec = (k: number) => {
        if (k === libres.length) {
          const cont = X.liens.every(([b, h]) => E.sous(Y, f[b], f[h]));
          if (cont && Y.points.every((_, y) => f.includes(y))) sols.push(f.map((y) => Y.noms![y]).join(''));
          return;
        }
        for (let y = 0; y < Y.points.length; y++) { f[libres[k]] = y; rec(k + 1); }
      };
      rec(0);
      check(sols.length > 0, `${n.id}: applications continues surjectives : ${sols.join(', ')}`);
      check(libres.length === n.seuils[0], `${n.id}: affectations minimales ${libres.length} = seuil 3★`);
      break;
    }
  }
}

titre('Île des Tribus');
for (const n of NIVEAUX_TRIBUS) {
  switch (n.type) {
    case 'famille': famille(n); break;
    case 'atomes': {
      const p = E.partitionEngendree(n.evenements.map((e) => e.masque), 6);
      const tribu = E.tribuEngendree(n.evenements.map((e) => e.masque), 6);
      console.log(`     ${n.id}: atomes ${p.map((m) => `{${E.elements(m, 6).map((i) => i + 1)}}`).join(' ')}`);
      check(p.length === 4 && tribu.size === 16, `${n.id}: 4 atomes, tribu à ${tribu.size} événements`);
      check(E.atomes(tribu).sort().join() === p.sort().join(), `${n.id}: atomes de la tribu = partition engendrée`);
      break;
    }
    case 'mesurable': {
      const N = n.valeurs.length;
      const min = n.atomes.reduce((s, a) => {
        const v = E.elements(a, N).map((i) => n.valeurs[i]);
        const freq = Math.max(...v.map((x) => v.filter((y) => y === x).length));
        return s + v.length - freq;
      }, 0);
      check(n.atomes.reduce((s, a) => s | a, 0) === E.plein(N) && n.atomes.every((a, i) => n.atomes.every((b, j) => i === j || !(a & b))), `${n.id}: les atomes partitionnent Ω`);
      check(min === n.seuils[0], `${n.id}: barres à modifier au minimum ${min} = seuil 3★`);
      break;
    }
    case 'masses': {
      const sols: number[][] = [];
      for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) for (let c = 0; c <= 10; c++) for (let d = 0; d <= 10; d++) {
        const x = [a, b, c, d];
        if (n.contraintes.every((k) => k.zones.reduce((s, z) => s + x[z], 0) === k.valeur)) sols.push(x);
      }
      check(sols.length === 1, `${n.id}: solution unique ${JSON.stringify(sols)}`);
      check(sols[0].reduce((s, x) => s + x, 0) === n.seuils[0], `${n.id}: grains minimaux = seuil 3★`);
      break;
    }
    case 'independance': {
      const N = n.cote ** 2;
      const A = E.depuis(n.a);
      for (const m of n.manches) {
        let existe = false;
        for (let B = 0; B < 1 << N && !existe; B++) if (E.cardinal(B) === m.taille && E.cardinal(A & B) * N === n.a.length * m.taille) existe = true;
        check(existe === m.possible, `${n.id}: P(B) = ${m.taille}/${N} : ${existe ? 'possible' : 'impossible'}`);
      }
      break;
    }
    case 'esperance': {
      const moyennes = n.atomes.map((a) => {
        const p = E.elements(a, n.masses.length);
        return p.reduce((s, i) => s + n.masses[i] * n.valeurs[i], 0) / p.reduce((s, i) => s + n.masses[i], 0);
      });
      check(moyennes.every((x) => Number.isInteger(x * 2) && x >= 0 && x <= 6), `${n.id}: niveaux atteignables ${moyennes.join(', ')}`);
      const I = n.masses.reduce((s, m, i) => s + m * n.valeurs[i], 0);
      check(I === 32, `${n.id}: intégrale de f = ${I}, comme dans l’explication`);
      break;
    }
  }
}

titre('Île Vectorielle');
const det = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const app = (m: M, [x, y]: V): V => [m[0][0] * x + m[0][1] * y, m[1][0] * x + m[1][1] * y];
for (const n of NIVEAUX_VECTORIEL) {
  switch (n.type) {
    case 'combinaison': {
      check(det(n.u, n.v) !== 0, `${n.id}: (u, v) est une base, det = ${det(n.u, n.v)}`);
      const s = n.cibles.reduce((t, [a, b]) => t + Math.abs(a) + Math.abs(b), 0);
      check(s === n.seuils[0], `${n.id}: pas minimaux ${s} = seuil 3★`);
      break;
    }
    case 'dependance': {
      let min = Infinity;
      const [u, v, w] = n.vecteurs;
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) {
        if (!a && !b && !c) continue;
        if (a * u[0] + b * v[0] + c * w[0] === 0 && a * u[1] + b * v[1] + c * w[1] === 0) min = Math.min(min, Math.abs(a) + Math.abs(b) + Math.abs(c));
      }
      check(min === n.seuils[0], `${n.id}: réglages minimaux ${min} = seuil 3★`);
      break;
    }
    case 'matrice': {
      let s = 0;
      for (const m of n.cibles) {
        s += (m[0][0] !== 1 || m[1][0] !== 0 ? 1 : 0) + (m[0][1] !== 0 || m[1][1] !== 1 ? 1 : 0);
        const dedans = n.forme.every((p) => { const [x, y] = app(m, p); return Math.abs(x) <= 6 && Math.abs(y) <= 7; });
        check(dedans, `${n.id}: l’image par ${JSON.stringify(m)} tient dans le plan affiché`);
      }
      check(s === n.seuils[0], `${n.id}: déplacements minimaux ${s} = seuil 3★`);
      break;
    }
    case 'determinant': {
      let v = n.depart;
      for (const c of n.cibles) {
        let trouve: V | null = null;
        for (let x = -6; x <= 6 && !trouve; x++) for (let y = -7; y <= 7 && !trouve; y++) if ((x || y) && det(n.u, [x, y]) === c) trouve = [x, y];
        check(!!trouve && det(n.u, v) !== c, `${n.id}: det = ${c} atteignable, par exemple v = ${trouve}`);
        v = n.depart;
      }
      check(n.cibles.length === n.seuils[0], `${n.id}: un déplacement par manche = seuil 3★`);
      break;
    }
    case 'noyau': {
      for (const m of n.manches) {
        let sol: V | null = null;
        for (let x = -6; x <= 6 && !sol; x++) for (let y = -7; y <= 7 && !sol; y++) {
          const r = app(n.m, [x, y]);
          if (m.genre === 'noyau' ? (x || y) && !r[0] && !r[1] : r[0] === m.b[0] && r[1] === m.b[1]) sol = [x, y];
        }
        const attendu = m.genre === 'noyau' || det(app(n.m, [1, 0]), m.b) === 0;
        check(!!sol === attendu, `${n.id}: ${m.genre === 'noyau' ? 'noyau' : `M x = (${m.b})`} ${sol ? `résolu par x = (${sol})` : 'sans solution'}`);
      }
      break;
    }
    case 'propres': {
      const dirs = new Set<string>();
      for (let x = -6; x <= 6; x++) for (let y = -7; y <= 7; y++) {
        if (!x && !y) continue;
        if (det([x, y], app(n.m, [x, y])) === 0) { const g = Math.abs(x) || Math.abs(y); const s = x < 0 || (x === 0 && y < 0) ? -1 : 1; dirs.add(`${(s * x) / g},${(s * y) / g}`); }
      }
      check(dirs.size === 2, `${n.id}: deux directions propres (${[...dirs].join(' ; ')})`);
      break;
    }
  }
}

process.exit(ok ? 0 : 1);
