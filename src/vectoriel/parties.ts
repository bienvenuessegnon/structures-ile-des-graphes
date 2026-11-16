import { el, svg } from '../dom';
import type { Point } from '../niveaux';
import { attendre, Partie, type ConstructeurPartie } from '../partie';
import { bouton, libelleManche, Plateau, selecteur, texte } from '../plateau';
import type { M, NiveauVectoriel, V } from './niveaux';

type N<T extends NiveauVectoriel['type']> = Extract<NiveauVectoriel, { type: T }>;

const appliquer = (m: M, [x, y]: V): V => [m[0][0] * x + m[0][1] * y, m[1][0] * x + m[1][1] * y];
const det = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const plus = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const fois = (k: number, a: V): V => [k * a[0], k * a[1]];
const egaux = (a: V, b: V) => a[0] === b[0] && a[1] === b[1];
const ecrire = (x: number) => String(x).replace('-', '−');
const coord = ([x, y]: V) => `(${ecrire(x)}, ${ecrire(y)})`;

/** Plan repéré : origine au centre du plateau, 30 px par unité, ordonnées vers le haut. */
class Repere extends Plateau {
  readonly O: Point = [180, 236];
  readonly u = 30;
  readonly grille: SVGGElement;
  readonly dessous: SVGGElement;
  readonly dessus: SVGGElement;
  readonly poignees: SVGGElement;
  constructor(classe = '') {
    super(`repere ${classe}`);
    this.racine.append(svg('defs', {}, ...['u', 'v', 'w', 'x', 'mx', 'neutre'].map((c) =>
      svg('marker', { id: `fl-${c}`, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' },
        svg('path', { d: 'M0 0.5 L10 5 L0 9.5 z', class: `pointe-${c}` })))));
    this.grille = this.calque('grille');
    for (let x = -6; x <= 6; x++) this.grille.append(svg('line', { class: x ? 'g' : 'axe', x1: this.X([x, 0])[0], x2: this.X([x, 0])[0], y1: 0, y2: 460 }));
    for (let y = -7; y <= 7; y++) this.grille.append(svg('line', { class: y ? 'g' : 'axe', y1: this.X([0, y])[1], y2: this.X([0, y])[1], x1: 0, x2: 360 }));
    this.dessous = this.calque();
    this.dessus = this.calque();
    this.poignees = this.calque();
  }
  X([x, y]: V | Point): Point {
    return [this.O[0] + x * this.u, this.O[1] - y * this.u];
  }
  /** Point du plateau → point entier du plan le plus proche. */
  entier(p: Point, borne = 6): V {
    const c = (t: number) => Math.max(-borne, Math.min(borne, Math.round(t)));
    return [c((p[0] - this.O[0]) / this.u), c((this.O[1] - p[1]) / this.u)];
  }
  fleche(de: V, a: V, classe: string, marque = classe): SVGLineElement {
    const [x1, y1] = this.X(de);
    const [x2, y2] = this.X(a);
    return svg('line', { class: `fleche ${classe}`, x1, y1, x2, y2, 'marker-end': de[0] === a[0] && de[1] === a[1] ? undefined : `url(#fl-${marque})` });
  }
  poignee(p: V, classe: string): SVGGElement {
    const [x, y] = this.X(p);
    return svg('g', { class: `poignee ${classe}`, transform: `translate(${x} ${y})` }, svg('circle', { class: 'zone', r: 24 }), svg('circle', { class: 'rond', r: 9 }));
  }
  etiquette(p: V, contenu: string, classe: string, dx = 12, dy = -12) {
    const [x, y] = this.X(p);
    return texte(x + dx, y + dy, contenu, `etiquette-vec ${classe}`);
  }
}

/** Glisser une poignée sur les points entiers du plan. */
abstract class PartieRepere<T extends NiveauVectoriel> extends Partie<T, Repere> {
  saisie = -1;
  avant: V = [0, 0];
  abstract poignees(): V[];
  abstract deplacer(i: number, p: V): void;
  protected appui(p: Point) {
    let dm = 30;
    this.saisie = -1;
    this.poignees().forEach((q, i) => {
      const [x, y] = this.scene.X(q);
      const d = Math.hypot(x - p[0], y - p[1]);
      if (d < dm) { dm = d; this.saisie = i; }
    });
    if (this.saisie >= 0) this.avant = this.poignees()[this.saisie].slice() as V;
  }
  protected glisse(p: Point) {
    if (this.saisie < 0) return;
    const q = this.scene.entier(p);
    if (!egaux(q, this.poignees()[this.saisie])) this.deplacer(this.saisie, q);
  }
  protected relache() {
    const i = this.saisie;
    this.saisie = -1;
    if (i < 0) return;
    if (!egaux(this.avant, this.poignees()[i])) {
      this.compter();
      this.apresDeplacement();
    }
  }
  protected apresDeplacement() {}
  protected async enchainer(manche: { k: number }, total: number, suite: () => void) {
    manche.k++;
    if (manche.k === total) return this.gagner();
    this.fini = true;
    await attendre(1100);
    this.fini = false;
    suite();
  }
}

/* 1. Combinaisons linéaires */
class PartieCombinaison extends Partie<N<'combinaison'>, Repere> {
  manche = 0;
  pas: [number, number][] = [];
  monter() {
    this.scene = new Repere('combinaison');
    const { u, v } = this.niveau;
    for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
      const p = plus(fois(a, u), fois(b, v));
      if (Math.abs(p[0]) <= 6 && Math.abs(p[1]) <= 7) {
        const [x, y] = this.scene.X(p);
        this.scene.grille.append(svg('circle', { class: 'reseau', cx: x, cy: y, r: 2.2 }));
      }
    }
    const pave = el('div', { class: 'pave' });
    for (const [nom, g, k] of [['+u', 0, 1], ['−u', 0, -1], ['+v', 1, 1], ['−v', 1, -1]] as const) {
      const b = bouton(nom, () => this.avancer(g, k), g ? 'teinte-v' : 'teinte-u');
      pave.append(b);
    }
    this.hote.controles.append(pave);
    this.debut();
  }
  private cible(): V {
    const [a, b] = this.niveau.cibles[this.manche];
    return plus(fois(a, this.niveau.u), fois(b, this.niveau.v));
  }
  private position(): V {
    return this.pas.reduce<V>((p, [g, k]) => plus(p, fois(k, g ? this.niveau.v : this.niveau.u)), [0, 0]);
  }
  private debut() {
    this.pas = [];
    this.hote.legende(libelleManche(this.manche, this.niveau.cibles.length, `Cible ${coord(this.cible())}`));
    this.dessiner();
  }
  recommencer() { this.debut(); }
  private avancer(g: number, k: number) {
    if (this.fini) return;
    const p = plus(this.position(), fois(k, g ? this.niveau.v : this.niveau.u));
    if (Math.abs(p[0]) > 6 || Math.abs(p[1]) > 7) return this.hote.statut('Ce pas sort du plan affiché.', 'alerte');
    this.pas.push([g, k]);
    this.compter();
    this.dessiner();
  }
  private dessiner() {
    const s = this.scene;
    const { u, v } = this.niveau;
    s.dessous.replaceChildren(s.fleche([0, 0], u, 'u fantome'), s.fleche([0, 0], v, 'v fantome'), s.etiquette(u, 'u', 'u'), s.etiquette(v, 'v', 'v', -14, -10));
    const c = this.cible();
    const [cx, cy] = s.X(c);
    const chaine: SVGElement[] = [svg('circle', { class: 'cible-vec', cx, cy, r: 13 })];
    let p: V = [0, 0];
    for (const [g, k] of this.pas) {
      const q = plus(p, fois(k, g ? v : u));
      chaine.push(s.fleche(p, q, g ? 'v' : 'u'));
      p = q;
    }
    const [px, py] = s.X(p);
    chaine.push(svg('circle', { class: 'curseur-vec', cx: px, cy: py, r: 7 }));
    s.dessus.replaceChildren(...chaine);
    const a = this.pas.filter(([g]) => !g).reduce((t, [, k]) => t + k, 0);
    const b = this.pas.filter(([g]) => g).reduce((t, [, k]) => t + k, 0);
    if (egaux(p, c)) {
      this.hote.statut(`${coord(c)} = ${ecrire(a)}·u + ${ecrire(b)}·v`.replace('+ −', '− '), 'succes');
      this.suite();
    } else this.hote.statut(`Position ${coord(p)} = ${ecrire(a)}·u + ${ecrire(b)}·v`.replace('+ −', '− '));
  }
  private async suite() {
    this.manche++;
    if (this.manche === this.niveau.cibles.length) return this.gagner();
    this.fini = true;
    await attendre(1000);
    this.fini = false;
    this.debut();
  }
}

/* 2. Famille liée */
class PartieDependance extends Partie<N<'dependance'>, Repere> {
  sel: ReturnType<typeof selecteur>[] = [];
  monter() {
    this.scene = new Repere('dependance');
    const reglages = el('div', { class: 'reglages' });
    this.sel = ['a', 'b', 'c'].map((nom) => selecteur(nom, -3, 3, 0, () => { this.compter(); this.dessiner(); }));
    this.sel.forEach((s, i) => s.racine.classList.add(['teinte-u', 'teinte-v', 'teinte-w'][i]));
    reglages.append(...this.sel.map((s) => s.racine));
    this.hote.controles.append(reglages);
    this.dessiner();
  }
  recommencer() {
    this.sel.forEach((s) => s.regler(0));
    this.dessiner();
  }
  private dessiner() {
    const s = this.scene;
    const vs = this.niveau.vecteurs;
    const noms = ['u', 'v', 'w'];
    s.dessous.replaceChildren(...vs.flatMap((v, i) => [s.fleche([0, 0], v, `${noms[i]} fantome`), s.etiquette(v, noms[i], noms[i])]));
    const k = this.sel.map((x) => x.valeur);
    let p: V = [0, 0];
    const chaine: SVGElement[] = [];
    vs.forEach((v, i) => {
      const q = plus(p, fois(k[i], v));
      if (k[i]) chaine.push(s.fleche(p, q, noms[i]));
      p = q;
    });
    const [x, y] = s.X(p);
    const [ox, oy] = s.X([0, 0]);
    chaine.unshift(svg('circle', { class: 'cible-vec', cx: ox, cy: oy, r: 13 }));
    chaine.push(svg('circle', { class: 'curseur-vec', cx: x, cy: y, r: 7 }));
    s.dessus.replaceChildren(...chaine);
    const tousNuls = k.every((c) => c === 0);
    if (tousNuls) return this.hote.statut('Tous nuls : trop facile. Il faut au moins un coefficient non nul.');
    if (egaux(p, [0, 0])) {
      this.hote.statut(`${ecrire(k[0])}·u + ${ecrire(k[1])}·v + ${ecrire(k[2])}·w = 0`.replace(/\+ −/g, '− '), 'succes');
      return this.gagner();
    }
    this.hote.statut(`Arrivée en ${coord(p)}.`);
  }
}

/* 3. Matrice : images de e1 et e2 */
class PartieMatrice extends PartieRepere<N<'matrice'>> {
  manche = { k: 0 };
  cols: [V, V] = [[1, 0], [0, 1]];
  lecture!: HTMLElement;
  poignees() { return this.cols; }
  monter() {
    this.scene = new Repere('matrice');
    this.lecture = el('div', { class: 'lecture-matrice', 'aria-live': 'polite' });
    this.hote.controles.append(this.lecture);
    this.debut();
  }
  private debut() {
    this.cols = [[1, 0], [0, 1]];
    this.hote.legende(libelleManche(this.manche.k, this.niveau.cibles.length, 'Recouvrez la silhouette'));
    this.dessiner();
  }
  recommencer() { this.debut(); }
  deplacer(i: number, p: V) {
    this.cols[i] = p;
    this.dessiner();
  }
  private image = (m: M) => this.niveau.forme.map((p) => this.scene.X(appliquer(m, p)).join(',')).join(' ');
  private actuelle = (): M => [[this.cols[0][0], this.cols[1][0]], [this.cols[0][1], this.cols[1][1]]];
  private dessiner() {
    const s = this.scene;
    const cible = this.niveau.cibles[this.manche.k];
    const m = this.actuelle();
    const lignes: SVGElement[] = [];
    for (let k = -8; k <= 8; k++) {
      const a = plus(fois(k, this.cols[0]), fois(-12, this.cols[1])), b = plus(fois(k, this.cols[0]), fois(12, this.cols[1]));
      const c = plus(fois(k, this.cols[1]), fois(-12, this.cols[0])), d = plus(fois(k, this.cols[1]), fois(12, this.cols[0]));
      for (const [p, q] of [[a, b], [c, d]]) {
        const [x1, y1] = s.X(p), [x2, y2] = s.X(q);
        lignes.push(svg('line', { class: 'grille-image', x1, y1, x2, y2 }));
      }
    }
    s.dessous.replaceChildren(...lignes, svg('polygon', { class: 'silhouette-vec', points: this.image(cible) }));
    s.dessus.replaceChildren(
      svg('polygon', { class: 'forme-vec', points: this.image(m) }),
      s.fleche([0, 0], this.cols[0], 'u'), s.fleche([0, 0], this.cols[1], 'v'),
      s.etiquette(this.cols[0], 'f(e₁)', 'u', 0, 22), s.etiquette(this.cols[1], 'f(e₂)', 'v', -26, -6),
    );
    s.poignees.replaceChildren(s.poignee(this.cols[0], 'u'), s.poignee(this.cols[1], 'v'));
    this.lecture.replaceChildren(
      el('span', { class: 'parenthese' }, '('),
      el('span', { class: 'colonnes' },
        el('span', { class: 'col-u' }, el('b', {}, ecrire(m[0][0])), el('b', {}, ecrire(m[1][0]))),
        el('span', { class: 'col-v' }, el('b', {}, ecrire(m[0][1])), el('b', {}, ecrire(m[1][1])))),
      el('span', { class: 'parenthese' }, ')'),
    );
    const ok = m.every((l, i) => l.every((x, j) => x === cible[i][j]));
    if (ok) this.hote.statut('La figure recouvre sa silhouette.', 'succes');
    else this.hote.statut(`f(e₁) = ${coord(this.cols[0])}, f(e₂) = ${coord(this.cols[1])}`);
  }
  protected apresDeplacement() {
    const m = this.actuelle();
    const cible = this.niveau.cibles[this.manche.k];
    if (m.every((l, i) => l.every((x, j) => x === cible[i][j]))) this.enchainer(this.manche, this.niveau.cibles.length, () => this.debut());
  }
}

/* 4. Déterminant */
class PartieDeterminant extends PartieRepere<N<'determinant'>> {
  manche = { k: 0 };
  v: V = [0, 0];
  poignees() { return [this.v]; }
  monter() {
    this.scene = new Repere('determinant');
    this.debut();
  }
  private debut() {
    this.v = this.niveau.depart.slice() as V;
    const c = this.niveau.cibles[this.manche.k];
    this.hote.legende(libelleManche(this.manche.k, this.niveau.cibles.length, `det(u, v) = ${ecrire(c)}${c === 0 ? ', avec v non nul' : ''}`));
    this.dessiner();
  }
  recommencer() { this.debut(); }
  deplacer(_i: number, p: V) {
    this.v = p;
    this.dessiner();
  }
  private juste() {
    const c = this.niveau.cibles[this.manche.k];
    return det(this.niveau.u, this.v) === c && !egaux(this.v, [0, 0]);
  }
  private dessiner() {
    const s = this.scene;
    const u = this.niveau.u, v = this.v;
    const d = det(u, v);
    const coins = [[0, 0], u, plus(u, v), v].map((p) => s.X(p as V).join(',')).join(' ');
    s.dessous.replaceChildren(svg('polygon', { class: `aire ${d > 0 ? 'positive' : d < 0 ? 'negative' : 'nulle'}`, points: coins }));
    s.dessus.replaceChildren(s.fleche([0, 0], u, 'u'), s.fleche([0, 0], v, 'v'), s.etiquette(u, 'u', 'u', 12, 14), s.etiquette(v, 'v', 'v', -14, -10));
    s.poignees.replaceChildren(s.poignee(v, 'v'));
    const [mx, my] = s.X(fois(0.5, plus(u, v)));
    s.dessus.append(texte(mx, my, ecrire(d), 'valeur-aire'));
    if (this.juste()) this.hote.statut(`det(u, v) = ${ecrire(d)}.`, 'succes');
    else if (egaux(v, [0, 0])) this.hote.statut('v est nul : choisissez un vecteur non nul.', 'alerte');
    else {
      const f = (x: number) => (x < 0 ? `(${ecrire(x)})` : String(x));
      this.hote.statut(`det(u, v) = ${f(u[0])} × ${f(v[1])} − ${f(u[1])} × ${f(v[0])} = ${ecrire(d)}`);
    }
  }
  protected apresDeplacement() {
    if (this.juste()) this.enchainer(this.manche, this.niveau.cibles.length, () => this.debut());
  }
}

/* 5. Noyau et image */
class PartieNoyau extends PartieRepere<N<'noyau'>> {
  manche = { k: 0 };
  x: V = [1, 0];
  poignees() { return [this.x]; }
  monter() {
    this.scene = new Repere('noyau');
    const m = this.niveau.m;
    const dir = appliquer(m, [1, 0]);
    const [x1, y1] = this.scene.X(fois(-10, dir)), [x2, y2] = this.scene.X(fois(10, dir));
    this.scene.grille.append(svg('line', { class: 'droite-image', x1, y1, x2, y2 }));
    const [ex, ey] = this.scene.X(fois(1.6, dir));
    this.scene.grille.append(texte(ex + 22, ey, 'Im M', 'etiquette-vec mx'));
    this.hote.controles.append(bouton('Aucune solution', () => this.declarer()));
    this.debut();
  }
  private get m() { return this.niveau.manches[this.manche.k]; }
  private debut() {
    this.x = [1, 0];
    const m = this.m;
    this.hote.legende(libelleManche(this.manche.k, this.niveau.manches.length,
      m.genre === 'noyau' ? 'Trouvez x non nul tel que M x = 0' : `Trouvez x tel que M x = ${coord(m.b)}`));
    this.dessiner();
  }
  recommencer() { this.debut(); }
  deplacer(_i: number, p: V) {
    this.x = p;
    this.dessiner();
  }
  private juste() {
    const mx = appliquer(this.niveau.m, this.x);
    const m = this.m;
    return m.genre === 'noyau' ? egaux(mx, [0, 0]) && !egaux(this.x, [0, 0]) : egaux(mx, m.b);
  }
  private dessiner() {
    const s = this.scene;
    const mx = appliquer(this.niveau.m, this.x);
    const m = this.m;
    const extra: SVGElement[] = [];
    const cible: V = m.genre === 'noyau' ? [0, 0] : m.b;
    const [cx, cy] = s.X(cible);
    extra.push(svg('circle', { class: 'cible-vec', cx, cy, r: 13 }));
    if (m.genre !== 'noyau') extra.push(s.etiquette(cible, 'b', 'cible', 16, 0));
    s.dessous.replaceChildren(...extra);
    s.dessus.replaceChildren(s.fleche([0, 0], mx, 'mx'), s.fleche([0, 0], this.x, 'x'), s.etiquette(this.x, 'x', 'x'), s.etiquette(mx, 'M x', 'mx', 18, 12));
    s.poignees.replaceChildren(s.poignee(this.x, 'x'));
    if (this.juste()) this.hote.statut(`x = ${coord(this.x)} donne M x = ${coord(mx)}.`, 'succes');
    else this.hote.statut(`x = ${coord(this.x)}, M x = ${coord(mx)}`);
  }
  protected apresDeplacement() {
    if (this.juste()) this.enchainer(this.manche, this.niveau.manches.length, () => this.debut());
  }
  private declarer() {
    if (this.fini) return;
    const m = this.m;
    const possible = m.genre === 'noyau' || det(appliquer(this.niveau.m, [1, 0]), m.b) === 0;
    if (possible) {
      this.compter();
      return this.hote.statut('Il existe une solution. Cherchez encore.', 'alerte');
    }
    this.hote.statut('Juste : b n’est pas sur la droite image.', 'succes');
    this.enchainer(this.manche, this.niveau.manches.length, () => this.debut());
  }
}

/* 6. Vecteurs propres */
class PartiePropres extends PartieRepere<N<'propres'>> {
  x: V = [1, 0];
  trouvees = new Map<string, number>();
  poignees() { return [this.x]; }
  monter() {
    this.scene = new Repere('propres');
    this.recommencer();
  }
  recommencer() {
    this.x = this.niveau.depart.slice() as V;
    this.trouvees.clear();
    this.scene.grille.querySelectorAll('.droite-propre, .lambda').forEach((e) => e.remove());
    this.dessiner();
  }
  deplacer(_i: number, p: V) {
    this.x = p;
    this.dessiner();
  }
  private direction([a, b]: V) {
    const g = (x: number, y: number): number => (y ? g(y, x % y) : Math.abs(x));
    const d = g(a, b) || 1;
    let [p, q] = [a / d, b / d];
    if (p < 0 || (p === 0 && q < 0)) [p, q] = [-p, -q];
    return `${p},${q}`;
  }
  private dessiner() {
    const s = this.scene;
    const mx = appliquer(this.niveau.m, this.x);
    s.dessus.replaceChildren(s.fleche([0, 0], mx, 'mx'), s.fleche([0, 0], this.x, 'x'), s.etiquette(this.x, 'x', 'x'), s.etiquette(mx, 'M x', 'mx', 18, 12));
    s.poignees.replaceChildren(s.poignee(this.x, 'x'));
    const nul = egaux(this.x, [0, 0]);
    if (nul) return this.hote.statut('Un vecteur propre est non nul.');
    if (det(this.x, mx) === 0) {
      const l = this.x[0] ? mx[0] / this.x[0] : mx[1] / this.x[1];
      this.hote.statut(`M x = ${l === 1 ? '' : l === -1 ? '−' : ecrire(l)}x : x est un vecteur propre, λ = ${ecrire(l)}.`, 'succes');
    } else this.hote.statut(`x = ${coord(this.x)}, M x = ${coord(mx)} : pas sur la même droite.`);
  }
  protected apresDeplacement() {
    const mx = appliquer(this.niveau.m, this.x);
    if (egaux(this.x, [0, 0]) || det(this.x, mx) !== 0) return;
    const cle = this.direction(this.x);
    if (this.trouvees.has(cle)) return;
    const l = this.x[0] ? mx[0] / this.x[0] : mx[1] / this.x[1];
    this.trouvees.set(cle, l);
    const s = this.scene;
    const [x1, y1] = s.X(fois(-12, this.x)), [x2, y2] = s.X(fois(12, this.x));
    s.grille.append(svg('line', { class: 'droite-propre', x1, y1, x2, y2 }));
    const [tx, ty] = s.X(fois(-1, this.x));
    s.grille.append(texte(tx - 22, ty + 4, `λ = ${ecrire(l)}`, 'lambda'));
    if (this.trouvees.size === 2) {
      this.hote.statut(`Deux directions propres : λ = ${[...this.trouvees.values()].map(ecrire).join(' et λ = ')}.`, 'succes');
      this.gagner();
    }
  }
}

export const PARTIES_VECTORIEL: Record<string, ConstructeurPartie> = {
  combinaison: PartieCombinaison,
  dependance: PartieDependance,
  matrice: PartieMatrice,
  determinant: PartieDeterminant,
  noyau: PartieNoyau,
  propres: PartiePropres,
};
