import { el, svg } from '../dom';
import { PartieFamille } from '../famille';
import * as E from '../maths/ensembles';
import type { Point } from '../niveaux';
import { attendre, Partie, type ConstructeurPartie } from '../partie';
import { bouton, cleSous, libelleManche, Plateau, texte } from '../plateau';
import type { NiveauTribus } from './niveaux';

type N<T extends NiveauTribus['type']> = Extract<NiveauTribus, { type: T }>;
const TEINTES = ['teinte-0', 'teinte-1', 'teinte-2', 'teinte-3'];

function palette(k: number, change: (c: number) => void) {
  const p = el('div', { class: 'palette', role: 'radiogroup', 'aria-label': 'Couleurs' });
  for (let c = 0; c < k; c++) {
    const b = el('button', { class: `pastille ${TEINTES[c]}`, type: 'button', role: 'radio', 'aria-label': `Couleur ${c + 1}`, 'aria-checked': String(c === 0) });
    b.addEventListener('click', () => {
      change(c);
      p.querySelectorAll('.pastille').forEach((x, m) => x.setAttribute('aria-checked', String(m === c)));
    });
    p.append(b);
  }
  return p;
}

const fraction = (a: number, b: number) => {
  if (a === 0) return '0';
  const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
  const d = g(a, b);
  return b / d === 1 ? String(a / d) : `${a / d}/${b / d}`;
};

/* Atomes : colorier les faces indiscernables */
const PIPS: Record<number, Point[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
class PartieAtomes extends Partie<N<'atomes'>, Plateau> {
  couleurs: number[] = [];
  choisie = 0;
  faces: SVGGElement[] = [];
  monter() {
    this.scene = new Plateau('atomes');
    const calque = this.scene.calque();
    for (let i = 0; i < 6; i++) {
      const x = 70 + (i % 3) * 110;
      const y = 110 + Math.floor(i / 3) * 190;
      const g = svg('g', { class: 'face', 'data-cle': i, transform: `translate(${x} ${y})` },
        svg('rect', { class: 'de', x: -42, y: -42, width: 84, height: 84, rx: 16 }));
      for (const [px, py] of PIPS[i + 1]) g.append(svg('circle', { class: 'pip', cx: px * 21, cy: py * 21, r: 7 }));
      this.niveau.evenements.forEach((e, k) => {
        const dedans = !!(e.masque & (1 << i));
        g.append(svg('g', { class: `etiquette-evt ${dedans ? 'dans' : 'hors'}`, transform: `translate(${(k - 0.5) * 38} 66)` },
          svg('rect', { x: -16, y: -12, width: 32, height: 24, rx: 12 }), texte(0, 0, dedans ? e.nom : `${e.nom}ᶜ`)));
      });
      this.faces.push(g);
      calque.append(g);
    }
    this.scene.racine.append(texte(180, 430, 'A : pair · B : au plus 3', 'note'));
    this.hote.controles.append(palette(4, (c) => (this.choisie = c)));
    this.recommencer();
  }
  recommencer() {
    this.couleurs = new Array(6).fill(-1);
    this.maj();
  }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    const i = +c;
    if (this.couleurs[i] === this.choisie) return;
    this.couleurs[i] = this.choisie;
    this.compter();
    this.maj();
  }
  private cle = (i: number) => this.niveau.evenements.map((e) => (e.masque >> i) & 1).join('');
  private maj() {
    this.faces.forEach((f, i) => TEINTES.forEach((t, k) => f.classList.toggle(t, this.couleurs[i] === k)));
    const ev = this.niveau.evenements;
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const ci = this.couleurs[i], cj = this.couleurs[j];
      if (ci < 0 || cj < 0) continue;
      if (ci === cj && this.cle(i) !== this.cle(j)) {
        const e = ev.find((x) => ((x.masque >> i) & 1) !== ((x.masque >> j) & 1))!;
        const [d, h] = (e.masque >> i) & 1 ? [i, j] : [j, i];
        return this.hote.statut(`${d + 1} et ${h + 1} ont la même couleur, mais ${d + 1} est dans ${e.nom} et pas ${h + 1}.`, 'alerte');
      }
      if (ci !== cj && this.cle(i) === this.cle(j))
        return this.hote.statut(`${i + 1} et ${j + 1} sont dans les mêmes événements : rien ne permet de les distinguer.`, 'alerte');
    }
    const restent = this.couleurs.filter((c) => c < 0).length;
    if (restent) return this.hote.statut(`${restent} face${restent > 1 ? 's' : ''} à colorier.`);
    this.hote.statut(`${new Set(this.couleurs).size} atomes.`, 'succes');
    this.gagner();
  }
}

/* Fonction mesurable : barres à égaliser par bande */
class PartieMesurable extends Partie<N<'mesurable'>, Plateau> {
  v: number[] = [];
  barres: SVGRectElement[] = [];
  etiquettes: SVGTextElement[] = [];
  bandes: SVGRectElement[] = [];
  saisie = -1;
  avant = 0;
  xs: number[] = [];
  readonly base = 384;
  readonly unite = 42;
  readonly l = 28;
  monter() {
    const n = this.niveau.valeurs.length;
    this.scene = new Plateau('barres');
    let x = 22;
    const bord: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      if (i && this.atome(i) !== this.atome(i - 1)) x += 14;
      this.xs.push(x);
      x += this.l + 4;
    }
    this.niveau.atomes.forEach((a) => {
      const pts = E.elements(a, n);
      bord.push([this.xs[pts[0]] - 6, this.xs[pts[pts.length - 1]] + this.l + 6]);
    });
    const fond = this.scene.calque();
    bord.forEach(([g, d], k) => {
      const r = svg('rect', { class: `bande ${TEINTES[k]}`, x: g, y: 90, width: d - g, height: this.base - 90 + 28, rx: 12 });
      this.bandes.push(r);
      fond.append(r);
    });
    for (let y = 0; y <= this.niveau.max; y++) fond.append(svg('line', { class: 'graduation', x1: 14, x2: 346, y1: this.base - y * this.unite, y2: this.base - y * this.unite }));
    const calque = this.scene.calque();
    for (let i = 0; i < n; i++) {
      const b = svg('rect', { class: 'barre', x: this.xs[i], width: this.l, rx: 5 });
      const t = texte(this.xs[i] + this.l / 2, 0, '', 'valeur-barre');
      calque.append(b, t, texte(this.xs[i] + this.l / 2, this.base + 16, `ω${i + 1}`, 'note'));
      this.barres.push(b);
      this.etiquettes.push(t);
    }
    this.scene.racine.append(texte(180, 40, 'bandes : les atomes de la tribu', 'note'));
    this.recommencer();
  }
  private atome = (i: number) => this.niveau.atomes.findIndex((a) => a & (1 << i));
  recommencer() {
    this.v = this.niveau.valeurs.slice();
    this.v.forEach((_, i) => this.dessiner(i));
    this.maj();
  }
  private dessiner(i: number) {
    const h = Math.max(this.v[i] * this.unite, 4);
    this.barres[i].setAttribute('y', String(this.base - h));
    this.barres[i].setAttribute('height', String(h));
    this.etiquettes[i].setAttribute('y', String(this.base - h - 14));
    this.etiquettes[i].textContent = String(this.v[i]);
  }
  private sous(p: Point) {
    return this.xs.findIndex((x) => p[0] >= x - 2 && p[0] <= x + this.l + 2);
  }
  protected appui(p: Point) {
    this.saisie = this.sous(p);
    if (this.saisie < 0) return;
    this.avant = this.v[this.saisie];
    this.barres[this.saisie].classList.add('saisie');
    this.glisse(p);
  }
  protected glisse(p: Point) {
    const i = this.saisie;
    if (i < 0) return;
    this.v[i] = Math.max(0, Math.min(this.niveau.max, Math.round((this.base - p[1]) / this.unite)));
    this.dessiner(i);
    this.maj(false);
  }
  protected relache() {
    const i = this.saisie;
    if (i < 0) return;
    this.saisie = -1;
    this.barres[i].classList.remove('saisie');
    if (this.v[i] !== this.avant) this.compter();
    this.maj();
  }
  private maj(final = true) {
    const n = this.v.length;
    let mauvaises = 0;
    this.niveau.atomes.forEach((a, k) => {
      const vals = new Set(E.elements(a, n).map((i) => this.v[i]));
      this.bandes[k].classList.toggle('constante', vals.size === 1);
      if (vals.size > 1) mauvaises++;
    });
    if (mauvaises) return this.hote.statut(`${mauvaises} bande${mauvaises > 1 ? 's' : ''} où f prend plusieurs valeurs.`);
    this.hote.statut('f est constante sur chaque atome.', 'succes');
    if (final) this.gagner();
  }
}

/* Mesure : déposer des grains */
const ZONES = ['A ∖ B', 'A ∩ B', 'B ∖ A', 'hors de A ∪ B'];
class PartieMasses extends Partie<N<'masses'>, Plateau> {
  grains: Point[][] = [[], [], [], []];
  calqueGrains!: SVGGElement;
  puces: SVGGElement[] = [];
  retrait = false;
  graine = 11;
  readonly A: Point = [133, 262];
  readonly B: Point = [227, 262];
  readonly r = 92;
  monter() {
    this.scene = new Plateau('masses');
    const fond = this.scene.calque();
    fond.append(
      svg('rect', { class: 'omega', x: 16, y: 104, width: 328, height: 324, rx: 18 }),
      svg('circle', { class: 'disque-a', cx: this.A[0], cy: this.A[1], r: this.r }),
      svg('circle', { class: 'disque-b', cx: this.B[0], cy: this.B[1], r: this.r }),
      texte(30, 124, 'Ω', 'nom-ensemble', 'start'),
      texte(this.A[0] - 52, this.A[1] - 98, 'A', 'nom-ensemble'),
      texte(this.B[0] + 52, this.B[1] - 98, 'B', 'nom-ensemble'),
    );
    this.calqueGrains = this.scene.calque();
    const haut = this.scene.calque();
    this.niveau.contraintes.forEach((c, k) => {
      const x = 8 + k * 87;
      const g = svg('g', { class: 'puce-contrainte', transform: `translate(${x} 16)` },
        svg('rect', { width: 82, height: 66, rx: 12 }), texte(41, 22, c.nom, 'nom-contrainte'), texte(41, 46, '', 'valeur-contrainte'));
      this.puces.push(g);
      haut.append(g);
    });
    const ajouter = el('button', { class: 'outil-mode', type: 'button', 'aria-pressed': 'true' }, '+ Déposer');
    const retirer = el('button', { class: 'outil-mode', type: 'button', 'aria-pressed': 'false' }, '− Retirer');
    const regler = (r: boolean) => {
      this.retrait = r;
      ajouter.setAttribute('aria-pressed', String(!r));
      retirer.setAttribute('aria-pressed', String(r));
    };
    ajouter.addEventListener('click', () => regler(false));
    retirer.addEventListener('click', () => regler(true));
    this.hote.controles.append(ajouter, retirer);
    this.recommencer();
  }
  recommencer() {
    this.grains = [[], [], [], []];
    this.dessiner();
  }
  zone([x, y]: Point): number {
    if (x < 16 || x > 344 || y < 104 || y > 428) return -1;
    const a = Math.hypot(x - this.A[0], y - this.A[1]) < this.r;
    const b = Math.hypot(x - this.B[0], y - this.B[1]) < this.r;
    return a && b ? 1 : a ? 0 : b ? 2 : 3;
  }
  private alea() {
    this.graine = (this.graine * 16807) % 2147483647;
    return (this.graine - 1) / 2147483646;
  }
  private place(z: number): Point {
    for (let essai = 0; essai < 400; essai++) {
      const p: Point = [26 + this.alea() * 308, 114 + this.alea() * 304];
      if (this.zone(p) !== z) continue;
      // à distance des bords des disques pour rester lisible
      const da = Math.abs(Math.hypot(p[0] - this.A[0], p[1] - this.A[1]) - this.r);
      const db = Math.abs(Math.hypot(p[0] - this.B[0], p[1] - this.B[1]) - this.r);
      if (da < 9 || db < 9) continue;
      if (this.grains[z].every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 17 - essai / 40)) return p;
    }
    return [180, 262];
  }
  protected appui(p: Point) {
    const z = this.zone(p);
    if (z < 0) return;
    if (this.retrait) {
      if (!this.grains[z].length) return this.hote.statut(`Aucun grain à retirer dans ${ZONES[z]}.`);
      this.grains[z].pop();
    } else this.grains[z].push(this.place(z));
    this.compter();
    this.dessiner();
  }
  private dessiner() {
    this.calqueGrains.replaceChildren(...this.grains.flatMap((g, z) => g.map(([x, y]) => svg('circle', { class: `grain zone-${z}`, cx: x, cy: y, r: 6.5 }))));
    let ok = 0;
    this.niveau.contraintes.forEach((c, k) => {
      const v = c.zones.reduce((s, z) => s + this.grains[z].length, 0);
      this.puces[k].querySelector('.valeur-contrainte')!.textContent = `${v} / ${c.valeur}`;
      this.puces[k].classList.toggle('juste', v === c.valeur);
      this.puces[k].classList.toggle('trop', v > c.valeur);
      if (v === c.valeur) ok++;
    });
    const total = this.niveau.contraintes.length;
    if (ok === total) {
      this.hote.statut(`Mesure trouvée : μ(A ∩ B) = ${this.grains[1].length}.`, 'succes');
      return this.gagner();
    }
    this.hote.statut(`${ok} condition${ok > 1 ? 's' : ''} sur ${total} remplie${ok > 1 ? 's' : ''}.`);
  }
}

/* Indépendance */
class PartieIndependance extends Partie<N<'independance'>, Plateau> {
  manche = 0;
  b = new Set<number>();
  cases: SVGGElement[] = [];
  lignes!: SVGGElement;
  readonly t = 64;
  readonly x0 = 52;
  readonly y0 = 26;
  monter() {
    const k = this.niveau.cote;
    this.scene = new Plateau('independance');
    const calque = this.scene.calque();
    for (let i = 0; i < k * k; i++) {
      const x = this.x0 + (i % k) * this.t, y = this.y0 + Math.floor(i / k) * this.t;
      const g = svg('g', { class: `case-proba${this.niveau.a.includes(i) ? ' dans-a' : ''}`, 'data-cle': i, transform: `translate(${x} ${y})` },
        svg('rect', { x: 3, y: 3, width: this.t - 6, height: this.t - 6, rx: 10 }));
      if (this.niveau.a.includes(i)) g.append(texte(14, 16, 'A', 'marque-a'));
      this.cases.push(g);
      calque.append(g);
    }
    this.lignes = this.scene.calque('calcul');
    this.hote.controles.append(bouton('C’est impossible', () => this.impossible()));
    this.debut();
  }
  private get m() { return this.niveau.manches[this.manche]; }
  private debut() {
    this.b.clear();
    const N = this.niveau.cote ** 2;
    this.hote.legende(libelleManche(this.manche, this.niveau.manches.length, `B de probabilité ${fraction(this.m.taille, N)}, indépendant de A`));
    this.maj();
  }
  recommencer() { this.debut(); }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    const i = +c;
    if (this.b.has(i)) this.b.delete(i);
    else this.b.add(i);
    this.compter();
    this.maj();
  }
  private async impossible() {
    if (this.fini) return;
    if (this.m.possible) {
      this.compter();
      return this.hote.statut('Un tel événement existe. Cherchez encore.', 'alerte');
    }
    this.hote.statut('En effet : A ∩ B devrait contenir un nombre non entier de cases.', 'succes');
    return this.suite();
  }
  private maj() {
    const N = this.niveau.cote ** 2;
    const a = this.niveau.a.length;
    const b = this.b.size;
    const ab = this.niveau.a.filter((i) => this.b.has(i)).length;
    this.cases.forEach((c, i) => c.classList.toggle('dans-b', this.b.has(i)));
    this.lignes.replaceChildren(
      texte(60, 316, 'P(A)', 'cle-proba', 'start'), texte(300, 316, fraction(a, N), 'val-proba', 'end'),
      texte(60, 346, 'P(B)', 'cle-proba', 'start'), texte(300, 346, fraction(b, N), 'val-proba', 'end'),
      texte(60, 376, 'P(A ∩ B)', 'cle-proba', 'start'), texte(300, 376, fraction(ab, N), 'val-proba', 'end'),
      texte(60, 406, 'P(A) · P(B)', 'cle-proba', 'start'), texte(300, 406, fraction(a * b, N * N), 'val-proba', 'end'),
    );
    if (b !== this.m.taille) return this.hote.statut(`B doit compter ${this.m.taille} cases (il en a ${b}).`);
    if (ab * N !== a * b) return this.hote.statut('Bonne taille, mais P(A ∩ B) ≠ P(A) · P(B).', 'alerte');
    this.hote.statut('A et B sont indépendants.', 'succes');
    this.suite();
  }
  private async suite() {
    this.manche++;
    if (this.manche === this.niveau.manches.length) return this.gagner();
    this.fini = true;
    await attendre(1200);
    this.fini = false;
    this.debut();
  }
}

/* Espérance conditionnelle : niveaux d'eau */
class PartieEsperance extends Partie<N<'esperance'>, Plateau> {
  niveaux: number[] = [];
  eaux: SVGRectElement[] = [];
  poignees: SVGGElement[] = [];
  bilans: SVGTextElement[] = [];
  bornes: [number, number][] = [];
  saisie = -1;
  avant = 0;
  readonly base = 404;
  readonly unite = 40;
  readonly m = 28;
  monter() {
    const { masses, valeurs, atomes } = this.niveau;
    this.scene = new Plateau('esperance');
    const fond = this.scene.calque();
    const barres = this.scene.calque();
    const eau = this.scene.calque();
    const haut = this.scene.calque();
    let x = 24;
    const xs: number[] = [];
    masses.forEach((_, i) => {
      if (i && atomes.findIndex((a) => a & (1 << i)) !== atomes.findIndex((a) => a & (1 << (i - 1)))) x += 16;
      xs.push(x);
      x += masses[i] * this.m;
    });
    for (let y = 0; y <= 6; y++) fond.append(svg('line', { class: 'graduation', x1: 14, x2: 346, y1: this.base - y * this.unite, y2: this.base - y * this.unite }));
    valeurs.forEach((v, i) => {
      const w = masses[i] * this.m;
      barres.append(svg('rect', { class: 'barre-creuse', x: xs[i] + 1, y: this.base - v * this.unite, width: w - 2, height: v * this.unite, rx: 3 }),
        texte(xs[i] + w / 2, this.base + 14, String(masses[i]), 'note'));
    });
    atomes.forEach((a, k) => {
      const pts = E.elements(a, masses.length);
      const g = xs[pts[0]], d = xs[pts[pts.length - 1]] + masses[pts[pts.length - 1]] * this.m;
      this.bornes.push([g, d]);
      fond.append(svg('rect', { class: `bande ${TEINTES[k]}`, x: g - 5, y: 120, width: d - g + 10, height: this.base - 120 + 26, rx: 12 }));
      const r = svg('rect', { class: 'eau', x: g, width: d - g });
      eau.append(r);
      this.eaux.push(r);
      const p = svg('g', { class: 'poignee-eau' },
        svg('rect', { class: 'zone', x: g - 6, y: -22, width: d - g + 12, height: 44 }),
        svg('line', { x1: g, x2: d, y1: 0, y2: 0 }),
        svg('rect', { class: 'prise', x: (g + d) / 2 - 16, y: -6, width: 32, height: 12, rx: 6 }));
      haut.append(p);
      this.poignees.push(p);
      if (k === 0) haut.append(texte(14, this.base + 34, 'largeur = masse · aire = masse × hauteur', 'note', 'start'));
      const b = texte((g + d) / 2, 60, '', 'bilan-eau');
      const b2 = texte((g + d) / 2, 84, '', 'bilan-eau doux');
      haut.append(b, b2);
      this.bilans.push(b, b2);
    });
    this.recommencer();
  }
  private integrale(k: number) {
    const { masses, valeurs, atomes } = this.niveau;
    return E.elements(atomes[k], masses.length).reduce((s, i) => s + masses[i] * valeurs[i], 0);
  }
  private masse(k: number) {
    const { masses, atomes } = this.niveau;
    return E.elements(atomes[k], masses.length).reduce((s, i) => s + masses[i], 0);
  }
  recommencer() {
    this.niveaux = this.niveau.atomes.map(() => 0);
    this.niveaux.forEach((_, k) => this.dessiner(k));
    this.maj();
  }
  private dessiner(k: number) {
    const y = this.base - this.niveaux[k] * this.unite;
    this.eaux[k].setAttribute('y', String(y));
    this.eaux[k].setAttribute('height', String(this.base - y));
    this.poignees[k].setAttribute('transform', `translate(0 ${y})`);
    const fmt = (x: number) => String(x).replace('.', ',');
    this.bilans[2 * k].textContent = `barres ${this.integrale(k)}`;
    this.bilans[2 * k + 1].textContent = `eau ${fmt(this.masse(k) * this.niveaux[k])}`;
  }
  protected appui(p: Point) {
    this.saisie = this.bornes.findIndex(([g, d]) => p[0] >= g - 8 && p[0] <= d + 8);
    if (this.saisie < 0) return;
    this.avant = this.niveaux[this.saisie];
    this.poignees[this.saisie].classList.add('saisie');
    this.glisse(p);
  }
  protected glisse(p: Point) {
    const k = this.saisie;
    if (k < 0) return;
    this.niveaux[k] = Math.max(0, Math.min(6, Math.round(((this.base - p[1]) / this.unite) * 2) / 2));
    this.dessiner(k);
    this.maj(false);
  }
  protected relache() {
    const k = this.saisie;
    if (k < 0) return;
    this.saisie = -1;
    this.poignees[k].classList.remove('saisie');
    if (this.niveaux[k] !== this.avant) this.compter();
    this.maj();
  }
  private maj(final = true) {
    let justes = 0;
    this.niveaux.forEach((h, k) => {
      const ok = h * this.masse(k) === this.integrale(k);
      this.eaux[k].classList.toggle('juste', ok);
      this.bilans[2 * k + 1].classList.toggle('juste', ok);
      if (ok) justes++;
    });
    const n = this.niveaux.length;
    if (justes < n) return this.hote.statut(`${justes} bande${justes > 1 ? 's' : ''} sur ${n} à niveau.`);
    this.hote.statut('Chaque bande contient autant d’eau que de barres.', 'succes');
    if (final) this.gagner();
  }
}

export const PARTIES_TRIBUS: Record<string, ConstructeurPartie> = {
  famille: PartieFamille,
  atomes: PartieAtomes,
  mesurable: PartieMesurable,
  masses: PartieMasses,
  independance: PartieIndependance,
  esperance: PartieEsperance,
};
