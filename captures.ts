// Parcours complet du jeu dans Chromium (viewport 390×844) et captures d'écran.
import { chromium, type Page } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { NIVEAUX } from './src/niveaux';
import * as G from './src/graphe';

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
