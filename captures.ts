// Parcours complet du jeu dans Chromium (viewport 390×844) et captures d'écran.
import { chromium, type Page } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { NIVEAUX } from './src/niveaux';
import * as G from './src/graphe';
import * as Gr from './src/maths/groupes';
import { NIVEAUX_ALGEBRE } from './src/algebre/niveaux';
import { NIVEAUX_TOPOLOGIE } from './src/topologie/niveaux';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const DOSSIER = 'captures';
mkdirSync(DOSSIER, { recursive: true });

const serveur = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise<void>((ok) => serveur.stdout.on('data', (d) => String(d).includes('localhost') && ok()));

const navigateur = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'fr-FR' });
const page = await contexte.newPage();
const erreurs: string[] = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));

let echecs = 0;
const verifier = (c: boolean, m: string) => {
  console.log((c ? 'OK   ' : 'ÉCHEC ') + m);
  if (!c) echecs++;
};
const pause = (ms: number) => page.waitForTimeout(ms);
const ecran = async (nom: string) => page.screenshot({ path: `${DOSSIER}/${nom}.png` });

async function versEcran(p: Page, x: number, y: number) {
  return p.evaluate(([x, y]) => {
    const m = (document.querySelector('.plateau') as SVGSVGElement).getScreenCTM()!;
    return [m.a * x + m.e, m.d * y + m.f];
  }, [x, y]);
}
async function toucher(x: number, y: number) {
  const [a, b] = await versEcran(page, x, y);
  await page.touchscreen.tap(a, b);
  await pause(90);
}
async function toucherSommet(n: (typeof NIVEAUX)[number], i: number) {
  await toucher(n.positions[i][0], n.positions[i][1]);
}
async function glisser(de: [number, number], vers: [number, number]) {
  const [a, b] = await versEcran(page, ...de);
  const [c, d] = await versEcran(page, ...vers);
  await page.mouse.move(a, b);
  await page.mouse.down();
  await page.mouse.move(c, d, { steps: 12 });
  await page.mouse.up();
  await pause(120);
}
async function ouvrir(i: number) {
  await page.goto(`${URL}#niveau-${i + 1}`);
  await page.waitForSelector('.plateau');
  await pause(500);
}
async function attendreFiche(nom: string, attendues?: number) {
  const ok = await page.waitForSelector('.resultat .feuille', { timeout: 15000 }).then(() => true, () => false);
  verifier(ok, `${nom} : fiche de réussite affichée`);
  if (!ok) return;
  await pause(900);
  const etoiles = await page.locator('.etoiles-grandes .etoile.pleine').count();
  if (attendues !== undefined) verifier(etoiles === attendues, `${nom} : ${etoiles} étoile(s), attendu ${attendues}`);
}

// Titre et carte
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await pause(1200);
await ecran('01-titre');
await page.getByRole('button', { name: 'Commencer' }).tap();
await pause(700);
await ecran('02-archipel');
verifier((await page.locator('.ile-carte').count()) === 5, 'Archipel : cinq îles, toutes ouvertes');
await page.locator('.ile-carte.ile-graphes').tap();
await pause(700);
await ecran('02-carte-debut');
verifier((await page.locator('.etape.verrouille').count()) === 7, 'Carte : 7 niveaux verrouillés au départ');

const N = NIVEAUX;

// 1. Arbre couvrant : d'abord une route qui ferme un cycle est refusée par le compteur d'étoiles
{
  const n = N[0] as Extract<(typeof N)[number], { type: 'arbre' }>;
  await ouvrir(0);
  const arbre: G.Arete[] = [[0, 1], [1, 2], [0, 3], [3, 4], [3, 5], [3, 6], [4, 7]];
  for (const [k, [u, v]] of arbre.entries()) {
    const i = n.candidates.findIndex(([a, b]) => a === u && b === v);
    const [x1, y1] = n.positions[n.candidates[i][0]];
    const [x2, y2] = n.positions[n.candidates[i][1]];
    await toucher((x1 + x2) / 2, (y1 + y2) / 2);
    if (k === 3) await ecran('03-niveau1-arbre');
  }
  await attendreFiche('Niveau 1', 3);
  await ecran('04-niveau1-reussite');
}

// 2. Euler possible
{
  const n = N[1];
  await ouvrir(1);
  // un mauvais aveu d'impossibilité compte une tentative
  await page.getByRole('button', { name: 'C’est impossible' }).tap();
  await pause(200);
  verifier((await page.locator('.statut').textContent())!.includes('existe'), 'Niveau 2 : « impossible » refusé quand le tracé existe');
  for (const v of [0, 1, 2, 3, 0, 2, 4, 3, 1]) await toucherSommet(n, v);
  await attendreFiche('Niveau 2', 2);
}

// 3. Königsberg : on essaie, on se bloque, on déclare l'impossibilité
{
  const n = N[2];
  await ouvrir(2);
  for (const v of [0, 2, 0, 3, 1, 2, 3]) await toucherSommet(n, v);
  await pause(500);
  await ecran('05-niveau3-konigsberg');
  const statut = (await page.locator('.statut').textContent())!;
  verifier(statut.includes('Impasse'), `Niveau 3 : impasse détectée (« ${statut} »)`);
  await page.getByRole('button', { name: 'C’est impossible' }).tap();
  await attendreFiche('Niveau 3', 3);
  await ecran('06-niveau3-reussite');
}

// 4. Coloration
{
  const n = N[3] as Extract<(typeof N)[number], { type: 'coloration' }>;
  await ouvrir(3);
  const c = new Array(n.positions.length).fill(-1);
  const adj = G.adjacence(n.positions.length, n.aretes);
  const essai = (i: number): boolean => {
    if (i === c.length) return true;
    for (let x = 0; x < n.k; x++) if (adj[i].every((v) => c[v] !== x)) { c[i] = x; if (essai(i + 1)) return true; c[i] = -1; }
    return false;
  };
  essai(0);
  // un conflit volontaire d'abord
  await page.locator('.pastille').nth(0).tap();
  await toucherSommet(n, 0);
  await toucherSommet(n, 1);
  verifier((await page.locator('.arete.conflit').count()) === 1, 'Niveau 4 : conflit signalé entre deux voisins');
  for (const x of [0, 1, 2]) {
    await page.locator('.pastille').nth(x).tap();
    for (let i = 0; i < c.length; i++) if (c[i] === x) {
      await toucherSommet(n, i);
      if (x === 1 && i === c.indexOf(1)) await ecran('07-niveau4-coloration');
    }
  }
  await attendreFiche('Niveau 4', 2);
}

// 5. Biparti
{
  const n = N[4];
  await ouvrir(4);
  for (let i = 0; i < 8; i++) {
    const pop = [0, 1, 2].filter((b) => i & (1 << b)).length;
    await toucherSommet(n, i);
    if (pop % 2) await toucherSommet(n, i);
  }
  await attendreFiche('Niveau 5', 2);
}

// 6. Dijkstra : un trajet trop cher, puis le bon
{
  const n = N[5];
  await ouvrir(5);
  for (const v of [1, 4, 7]) await toucherSommet(n, v);
  await pause(300);
  verifier((await page.locator('.statut').textContent())!.includes('moins coûteux'), 'Niveau 6 : trajet de coût 11 refusé');
  await pause(1500);
  for (const v of [3, 6, 5, 4]) await toucherSommet(n, v);
  await ecran('08-niveau6-trajet');
  await toucherSommet(n, 7);
  await pause(3200);
  await ecran('09-niveau6-dijkstra');
  await attendreFiche('Niveau 6', 2);
  await ecran('10-niveau6-reussite');
}

// 7. Hamilton
{
  const n = N[6];
  await ouvrir(6);
  for (const v of [0, 1, 2, 3, 4, 9, 7, 5]) await toucherSommet(n, v);
  await ecran('11-niveau7-hamilton');
  for (const v of [8, 6]) await toucherSommet(n, v);
  await attendreFiche('Niveau 7', 3);
}

// 8. Isomorphisme : échanges à la souris, suite minimale calculée par parcours en largeur
{
  const n = N[7] as Extract<(typeof N)[number], { type: 'isomorphisme' }>;
  await ouvrir(7);
  await ecran('12-niveau8-isomorphisme');
  const cle = (p: number[]) => p.join(',');
  const prec = new Map<string, [string, number, number] | null>([[cle(n.depart), null]]);
  const file = [n.depart];
  let fin: number[] | null = null;
  while (file.length) {
    const p = file.shift()!;
    if (G.superposition(n.aretes, p, n.cible)) { fin = p; break; }
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      const q = p.slice(); [q[i], q[j]] = [q[j], q[i]];
      if (!prec.has(cle(q))) { prec.set(cle(q), [cle(p), i, j]); file.push(q); }
    }
  }
  const echanges: [number, number][] = [];
  for (let k = cle(fin!); prec.get(k); k = prec.get(k)![0]) echanges.unshift([prec.get(k)![1], prec.get(k)![2]]);
  const place = n.depart.slice();
  for (const [i, j] of echanges) {
    await glisser(n.positions[place[i]], n.positions[place[j]]);
    [place[i], place[j]] = [place[j], place[i]];
  }
  await attendreFiche('Niveau 8', 3);
}


// ——— Les quatre nouvelles îles ———
async function ouvrirNiveau(ile: string, k: number) {
  await page.goto(`${URL}#${ile}-${k}`);
  await page.waitForSelector('.plateau');
  await pause(500);
}
async function toucherCle(cle: string | number, selecteur = '') {
  await page.locator(`.plateau ${selecteur}[data-cle="${cle}"]`).first().tap();
  await pause(110);
}
async function bouton(nom: string, fois = 1, attente = 120) {
  for (let i = 0; i < fois; i++) {
    await page.getByRole('button', { name: nom, exact: true }).tap();
    await pause(attente);
  }
}
const statut = async () => (await page.locator('.statut').textContent()) ?? '';
/** Repère vectoriel : point du plan → plateau. */
const R = (x: number, y: number): [number, number] => [180 + 30 * x, 236 - 30 * y];

await page.goto(`${URL}#archipel`);
await pause(700);
await page.locator('.ile-carte.ile-algebre').tap();
await pause(700);
await ecran('20-algebre-carte');
verifier((await page.locator('.etape.verrouille').count()) === 5, 'Île Algébrique : 5 niveaux verrouillés au départ');

// Algèbre 1 : mots minimaux trouvés par parcours en largeur dans D3
{
  const n = NIVEAUX_ALGEBRE[0] as Extract<(typeof NIVEAUX_ALGEBRE)[number], { type: 'symetries' }>;
  await ouvrirNiveau('algebre', 1);
  await ecran('21-algebre-triangle');
  for (const [k, cible] of n.cibles.entries()) {
    const mots: [Gr.Sym, string[]][] = [[Gr.neutre, []]];
    let mot: string[] = [];
    for (const [g, m] of mots) {
      if (Gr.egal(g, cible)) { mot = m; break; }
      for (const [x, nom] of [[Gr.R, 'r · tourner'], [Gr.S, 's · retourner']] as const) mots.push([Gr.compose(3, x, g), [...m, nom]]);
    }
    for (const b of mot) await bouton(b, 1, 600);
    if (k < n.cibles.length - 1) await pause(1000);
    if (k === 0) await ecran('22-algebre-triangle-manche');
  }
  await attendreFiche('Algèbre 1', 3);
  await ecran('23-algebre-triangle-reussite');
}

// Algèbre 2 : un saut raté, puis les quatre générateurs
{
  await ouvrirNiveau('algebre', 2);
  await toucherCle(4, '.heure');
  await pause(900);
  verifier((await statut()).includes('3 heures'), 'Algèbre 2 : le saut 4 n’allume que 3 heures');
  await toucherCle(5, '.heure');
  await pause(1800);
  await ecran('24-algebre-horloge');
  for (const k of [1, 7, 11]) { await toucherCle(k, '.heure'); await pause(1700); }
  await attendreFiche('Algèbre 2', 3);
}

// Algèbre 3 : table de Cayley de ℤ/4ℤ
{
  await ouvrirNiveau('algebre', 3);
  const vides = [[1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [3, 3]];
  for (const v of [0, 1, 2, 3]) {
    await page.locator('.glyphe-bouton').nth(v).tap();
    for (const [i, j] of vides) if ((i + j) % 4 === v) await toucherCle(`${i},${j}`, '.case');
    if (v === 1) await ecran('25-algebre-table');
  }
  await attendreFiche('Algèbre 3', 3);
}

// Algèbre 4 : sous-groupe {e, r², s, r²s}
{
  await ouvrirNiveau('algebre', 4);
  await toucherCle(2, '.tuile-groupe');
  verifier((await statut()).includes('pas dans votre choix'), `Algèbre 4 : produit sortant signalé (« ${await statut()} »)`);
  await ecran('26-algebre-sousgroupe');
  await toucherCle(0, '.tuile-groupe');
  await toucherCle(6, '.tuile-groupe');
  await attendreFiche('Algèbre 4', 3);
}

// Algèbre 5 : un essai associatif, puis un témoin
{
  const n = NIVEAUX_ALGEBRE[4] as Extract<(typeof NIVEAUX_ALGEBRE)[number], { type: 'associativite' }>;
  await ouvrirNiveau('algebre', 5);
  await bouton('Tester ce triplet');
  verifier((await statut()).includes('neutre'), 'Algèbre 5 : (0, 0, 0) respecte l’associativité');
  const T = n.table;
  let t: number[] = [];
  for (let a = 1; a < 5 && !t.length; a++) for (let b = 1; b < 5 && !t.length; b++) for (let c = 1; c < 5 && !t.length; c++)
    if (T[T[a][b]][c] !== T[a][T[b][c]]) t = [a, b, c];
  for (const [k, nom] of ['a', 'b', 'c'].entries()) await bouton(`${nom} plus un`, t[k], 60);
  await bouton('Tester ce triplet');
  await pause(300);
  await ecran('27-algebre-associativite');
  await attendreFiche('Algèbre 5', 2);
}

// Algèbre 6 : graphe de Cayley, une liaison fausse d'abord
{
  await ouvrirNiveau('algebre', 6);
  const I = (g: Gr.Sym) => Gr.indice(3, g);
  await toucherCle(I(Gr.neutre), '.noeud-groupe');
  await toucherCle(I([1, 1]), '.noeud-groupe');
  verifier((await statut()).includes('donne r, pas rs'), `Algèbre 6 : liaison fausse refusée (« ${await statut()} »)`);
  let k = 0;
  for (const [gen, nom] of [[Gr.R, 'r · flèche'], [Gr.S, 's · trait']] as const) {
    await page.getByRole('radio', { name: nom }).tap();
    for (const g of Gr.tous(3)) {
      const h = Gr.compose(3, gen, g);
      if (Gr.egal(gen, Gr.S) && I(h) < I(g)) continue;
      await toucherCle(I(g), '.noeud-groupe');
      await toucherCle(I(h), '.noeud-groupe');
      if (++k === 7) await ecran('28-algebre-graphe-cayley');
    }
  }
  await attendreFiche('Algèbre 6', 2);
}

// Topologie
await page.goto(`${URL}#ile-topologie`);
await pause(700);
await ecran('30-topologie-carte');
{
  await ouvrirNiveau('topologie', 1);
  await toucherCle(2, '.tuile');
  await ecran('31-topologie-ouverts');
  for (const m of [4, 7, 14]) await toucherCle(m, '.tuile');
  await attendreFiche('Topologie 1', 3);
}
{
  await ouvrirNiveau('topologie', 2);
  for (const [k, ajouts] of [[3, 5], [1, 3, 5], [2, 4]].entries()) {
    for (const i of ajouts) await toucherCle(i, '.point-relief');
    if (k === 0) await ecran('32-topologie-relief');
    if (k < 2) await pause(1200);
  }
  await attendreFiche('Topologie 2', 3);
}
{
  await ouvrirNiveau('topologie', 3);
  await toucherCle(4, '.point-relief');
  await ecran('33-topologie-adherence');
  await bouton('Valider');
  await pause(1300);
  await toucherCle(2, '.point-relief');
  await bouton('Valider');
  await pause(1300);
  await toucherCle(2, '.point-relief');
  await toucherCle(4, '.point-relief');
  await bouton('Valider');
  await attendreFiche('Topologie 3', 3);
}
{
  await ouvrirNiveau('topologie', 4);
  await toucherCle(3, '.point-relief');
  await pause(1400);
  await toucherCle(0, '.point-relief');
  await toucherCle(4, '.point-relief');
  await pause(300);
  await ecran('34-topologie-cercle-coupe');
  await pause(1200);
  await toucherCle(0, '.point-relief');
  await attendreFiche('Topologie 4', 3);
}
{
  const n = NIVEAUX_TOPOLOGIE[4] as Extract<(typeof NIVEAUX_TOPOLOGIE)[number], { type: 'lettres' }>;
  await ouvrirNiveau('topologie', 5);
  for (const [k, l] of n.lettres.entries()) {
    if (k === 1) {
      await toucherCle(3, '.bac-lettres');
      await pause(200);
      await ecran('35-topologie-lettres-indice');
    }
    await toucherCle(l.famille, '.bac-lettres');
  }
  await attendreFiche('Topologie 5', 2);
}
{
  await ouvrirNiveau('topologie', 6);
  await toucherCle('x1', '.point-relief');
  await toucherCle('y3', '.point-relief');
  await toucherCle('x2', '.point-relief');
  await toucherCle('y1', '.point-relief');
  verifier((await statut()).startsWith('Discontinue'), `Topologie 6 : discontinuité signalée (« ${await statut()} »)`);
  await ecran('36-topologie-continuite-rupture');
  await toucherCle('x2', '.point-relief');
  await toucherCle('y2', '.point-relief');
  await toucherCle('x3', '.point-relief');
  await toucherCle('y1', '.point-relief');
  await pause(300);
  await ecran('37-topologie-continuite');
  await attendreFiche('Topologie 6', 2);
}

// Tribus
await page.goto(`${URL}#ile-tribus`);
await pause(700);
await ecran('40-tribus-carte');
{
  await ouvrirNiveau('tribus', 1);
  await toucherCle(12, '.tuile');
  await ecran('41-tribus-engendree');
  for (const m of [2, 13, 14]) await toucherCle(m, '.tuile');
  await attendreFiche('Tribus 1', 3);
}
{
  await ouvrirNiveau('tribus', 2);
  const atomes = [[1, 3], [2], [4, 6], [5]];
  for (const [c, faces] of atomes.entries()) {
    await page.locator('.pastille').nth(c).tap();
    for (const f of faces) await toucherCle(f - 1, '.face');
    if (c === 2) await ecran('42-tribus-atomes');
  }
  await attendreFiche('Tribus 2', 3);
}
{
  await ouvrirNiveau('tribus', 3);
  const xs = [22, 54, 86, 118, 164, 196, 242, 274, 306];
  for (const [i, v] of [[1, 2], [3, 2], [5, 5], [7, 1]]) {
    await glisser([xs[i] + 14, 300], [xs[i] + 14, 384 - v * 42]);
    if (i === 3) await ecran('43-tribus-mesurable');
  }
  await attendreFiche('Tribus 3', 3);
}
{
  await ouvrirNiveau('tribus', 4);
  for (const [z, k] of [[[95, 262], 3], [[180, 262], 2], [[265, 262], 2], [[40, 400], 3]] as const) {
    for (let i = 0; i < k; i++) await toucher(z[0], z[1]);
    if (z[0] === 265) await ecran('44-tribus-masses');
  }
  await attendreFiche('Tribus 4', 3);
}
{
  await ouvrirNiveau('tribus', 5);
  await bouton('C’est impossible');
  for (const c of [0, 4, 8, 1, 2, 3, 5, 6]) await toucherCle(c, '.case-proba');
  await pause(300);
  await ecran('45-tribus-independance');
  await pause(1200);
  await bouton('C’est impossible');
  await attendreFiche('Tribus 5', 2);
}
{
  await ouvrirNiveau('tribus', 6);
  for (const [x, h] of [[80, 3], [180, 4], [280, 3]]) {
    await glisser([x, 404], [x, 404 - h * 40]);
    if (x === 180) await ecran('46-tribus-esperance');
  }
  await attendreFiche('Tribus 6', 3);
}

// Vectoriel
await page.goto(`${URL}#ile-vectoriel`);
await pause(700);
await ecran('50-vectoriel-carte');
{
  await ouvrirNiveau('vectoriel', 1);
  for (const [k, pas] of [['+u', '+v'], ['+u', '+u', '−v'], ['−u', '+v', '+v']].entries()) {
    for (const p of pas) await bouton(p);
    if (k === 1) await ecran('51-vectoriel-combinaison');
    await pause(1100);
  }
  await attendreFiche('Vectoriel 1', 3);
}
{
  await ouvrirNiveau('vectoriel', 2);
  await bouton('a plus un', 2, 80);
  await bouton('b moins un', 1, 80);
  await ecran('52-vectoriel-dependance');
  await bouton('c moins un', 1, 80);
  await attendreFiche('Vectoriel 2', 3);
}
{
  await ouvrirNiveau('vectoriel', 3);
  const manches: [[number, number], [number, number]][][] = [
    [[[0, 1], [-1, 0]], [[1, 0], [0, 1]]],
    [[[0, 1], [1, 1]]],
    [[[1, 0], [2, 0]], [[0, 1], [0, -1]]],
  ];
  for (const [k, gestes] of manches.entries()) {
    for (const [de, a] of gestes) await glisser(R(...de), R(...a));
    if (k === 0) await ecran('53-vectoriel-matrice');
    await pause(1200);
  }
  await attendreFiche('Vectoriel 3', 3);
}
{
  await ouvrirNiveau('vectoriel', 4);
  for (const [k, v] of [[-1, 2], [0, -2], [2, 1]].entries()) {
    await glisser(R(0, 2), R(v[0], v[1]));
    if (k === 1) await ecran('54-vectoriel-determinant');
    await pause(1200);
  }
  await attendreFiche('Vectoriel 4', 3);
}
{
  await ouvrirNiveau('vectoriel', 5);
  await glisser(R(1, 0), R(2, -1));
  await pause(1200);
  await glisser(R(1, 0), R(1, 1));
  await pause(1200);
  await ecran('55-vectoriel-noyau');
  await bouton('Aucune solution');
  await attendreFiche('Vectoriel 5', 3);
}
{
  await ouvrirNiveau('vectoriel', 6);
  await glisser(R(1, 0), R(1, 1));
  await ecran('56-vectoriel-propres');
  await glisser(R(1, 1), R(1, -1));
  await attendreFiche('Vectoriel 6', 3);
  await ecran('57-vectoriel-reussite');
}

await page.goto(`${URL}#archipel`);
await pause(800);
await ecran('15-archipel-progression');
verifier((await page.locator('.etape.verrouille').count()) === 0, 'Archipel affiché');
for (const ile of ['algebre', 'topologie', 'tribus', 'vectoriel']) {
  await page.goto(`${URL}#ile-${ile}`);
  await pause(400);
  verifier((await page.locator('.etape.faite').count()) === 6, `Île ${ile} : 6 niveaux réussis et enregistrés`);
}

// Carte après le parcours
await page.goto(`${URL}#carte`);
await pause(800);
await ecran('13-carte-progression');
verifier((await page.locator('.etape.verrouille').count()) === 0, 'Carte : tous les niveaux débloqués');
verifier((await page.locator('.etape.faite').count()) === 8, 'Carte : progression sauvegardée (8 niveaux faits)');

// Bac à sable
await page.goto(`${URL}#bac`);
await page.waitForSelector('.plateau');
await pause(600);
const lire = async (terme: string) => page.locator(`dt:text-is("${terme}") + dd`).textContent();
verifier((await lire('Euler'))!.includes('Chemin eulérien'), `Bac à sable : exemple → ${await lire('Euler')}`);
verifier((await lire('Biparti'))!.startsWith('Non'), `Bac à sable : exemple non biparti → ${await lire('Biparti')}`);
// ajout d'un sommet relié aux deux sommets impairs : tous les degrés deviennent pairs
await toucher(320, 420);
await toucher(320, 420);
await toucher(90, 120);
await toucher(320, 420);
await toucher(300, 290);
await pause(200);
verifier((await lire('Euler'))!.includes('Cycle eulérien'), `Bac à sable : après ajout → ${await lire('Euler')}`);
await ecran('14-bac-a-sable');
// effacer l'arête diagonale 0-2 : le pentagone + sommet devient...
await page.getByRole('button', { name: 'Effacer', exact: true }).tap();
await toucher(195, 205);
await pause(200);
console.log('     Bac à sable après effacement :', await lire('Taille'), '/', await lire('Euler'), '/', await lire('Biparti'));

// Hors ligne : nouvel onglet, attente du service worker, puis coupure du réseau
{
  const p2 = await contexte.newPage();
  p2.on('pageerror', (e) => erreurs.push(String(e)));
  p2.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await p2.goto(URL);
  await p2.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
    return true;
  });
  await contexte.setOffline(true);
  await p2.reload();
  await p2.waitForTimeout(800);
  verifier((await p2.locator('.grand-titre').textContent({ timeout: 5000 }).catch(() => null)) === 'Structures', 'Hors ligne : le jeu se recharge sans réseau');
  await p2.goto(`${URL}#niveau-4`);
  await p2.reload();
  await p2.waitForTimeout(600);
  verifier(await p2.locator('.plateau').isVisible(), 'Hors ligne : un niveau se charge sans réseau');
  await contexte.setOffline(false);
}

verifier(erreurs.length === 0, `Aucune erreur JavaScript${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
await navigateur.close();
serveur.kill();
console.log(echecs ? `${echecs} échec(s)` : 'Tous les contrôles passent.');
process.exit(echecs ? 1 : 0);
