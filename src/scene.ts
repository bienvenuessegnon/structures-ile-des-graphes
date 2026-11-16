import { svg } from './dom';
import type { Point } from './niveaux';

export const LARGEUR = 360;
export const HAUTEUR = 460;
export const RAYON = 19;

export interface OptionsScene {
  etiquettes?: string[];
  poids?: number[];
  /** Courbure pour les arêtes multiples. */
  multi?: boolean;
}

/**
 * Plateau SVG : sommets et arêtes persistants, dont on modifie les classes,
 * ce qui laisse les transitions CSS faire le travail d'animation.
 */
export class Scene {
  readonly racine: SVGSVGElement;
  readonly fond: SVGGElement;
  readonly calqueAretes: SVGGElement;
  readonly calqueTraces: SVGGElement;
  readonly calqueEtiquettes: SVGGElement;
  readonly calqueSommets: SVGGElement;
  readonly sommets: SVGGElement[] = [];
  readonly badges: SVGGElement[] = [];
  readonly chemins: SVGPathElement[] = [];
  readonly libellesPoids: SVGGElement[] = [];
  pos: Point[];
  aretes: [number, number][];
  private courbure: number[] = [];

  constructor(pos: Point[], aretes: [number, number][], private opt: OptionsScene = {}) {
    this.pos = pos.map((p) => [p[0], p[1]] as Point);
    this.aretes = aretes.map(([u, v]) => [u, v]);
    this.racine = svg('svg', {
      viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`,
      class: 'plateau',
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
    });
    this.fond = svg('g', { class: 'fond' });
    this.calqueAretes = svg('g', { class: 'aretes' });
    this.calqueTraces = svg('g', { class: 'traces' });
    this.calqueEtiquettes = svg('g', { class: 'poids' });
    this.calqueSommets = svg('g', { class: 'sommets' });
    this.racine.append(this.fond, this.calqueAretes, this.calqueTraces, this.calqueEtiquettes, this.calqueSommets);
    this.calculerCourbures();
    this.aretes.forEach((_, i) => this.creerArete(i));
    this.pos.forEach((_, i) => this.creerSommet(i));
  }

  private calculerCourbures() {
    const groupes = new Map<string, number[]>();
    this.aretes.forEach(([u, v], i) => {
      const k = u < v ? `${u}-${v}` : `${v}-${u}`;
      groupes.set(k, [...(groupes.get(k) ?? []), i]);
    });
    this.courbure = new Array(this.aretes.length).fill(0);
    if (!this.opt.multi) return;
    for (const ids of groupes.values()) {
      if (ids.length < 2) continue;
      ids.forEach((id, j) => {
        const [u, v] = this.aretes[id];
        const sens = u < v ? 1 : -1;
        this.courbure[id] = sens * (j - (ids.length - 1) / 2) * 56;
      });
    }
  }

  /** Point de contrôle (courbe quadratique) d'une arête. */
  private controle(i: number): Point {
    const [u, v] = this.aretes[i];
    const [x1, y1] = this.pos[u];
    const [x2, y2] = this.pos[v];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const c = this.courbure[i] ?? 0;
    if (!c) return [mx, my];
    const l = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / l) * (u < v ? 1 : -1);
    const ny = ((x2 - x1) / l) * (u < v ? 1 : -1);
    return [mx + nx * c, my + ny * c];
  }

  dArete(i: number, depuis?: number): string {
    let [u, v] = this.aretes[i];
    if (depuis !== undefined && depuis === v) [u, v] = [v, u];
    const [x1, y1] = this.pos[u];
    const [x2, y2] = this.pos[v];
    const [cx, cy] = this.controle(i);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  /** Milieu de la courbe (t = 1/2). */
  milieu(i: number): Point {
    const [u, v] = this.aretes[i];
    const [cx, cy] = this.controle(i);
    return [
      0.25 * this.pos[u][0] + 0.5 * cx + 0.25 * this.pos[v][0],
      0.25 * this.pos[u][1] + 0.5 * cy + 0.25 * this.pos[v][1],
    ];
  }

  private creerArete(i: number) {
    const p = svg('path', { d: this.dArete(i), class: 'arete' });
    this.calqueAretes.append(p);
    this.chemins[i] = p;
    const w = this.opt.poids?.[i];
    if (w !== undefined) {
      const [mx, my] = this.milieu(i);
      const g = svg('g', { class: 'poids-etiquette', transform: `translate(${mx} ${my})` },
        svg('rect', { x: -11, y: -10, width: 22, height: 20, rx: 6 }),
        svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }),
      );
      g.querySelector('text')!.textContent = String(w);
      this.calqueEtiquettes.append(g);
      this.libellesPoids[i] = g;
    }
  }

  private creerSommet(i: number) {
    const [x, y] = this.pos[i];
    const g = svg('g', { class: 'sommet', transform: `translate(${x} ${y})`, 'data-i': i },
      svg('circle', { class: 'halo', r: RAYON + 9 }),
      svg('circle', { class: 'disque', r: RAYON }),
    );
    const e = this.opt.etiquettes?.[i];
    if (e) {
      const t = svg('text', { class: 'nom', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = e;
      g.append(t);
    }
    const badge = svg('g', { class: 'badge', transform: `translate(${RAYON - 2} ${-RAYON + 2})` },
      svg('rect', { x: -10, y: -9, width: 20, height: 18, rx: 9 }),
      svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }),
    );
    g.append(badge);
    this.badges[i] = badge;
    this.calqueSommets.append(g);
    this.sommets[i] = g;
  }

  ajouterSommet(p: Point): number {
    this.pos.push([p[0], p[1]]);
    const i = this.pos.length - 1;
    this.creerSommet(i);
    return i;
  }

  ajouterArete(u: number, v: number): number {
    this.aretes.push([u, v]);
    this.courbure.push(0);
    const i = this.aretes.length - 1;
    this.creerArete(i);
    return i;
  }

  /** Reconstruit tout (après suppression dans le bac à sable). */
  reconstruire(pos: Point[], aretes: [number, number][]) {
    this.pos = pos.map((p) => [p[0], p[1]] as Point);
    this.aretes = aretes.map(([u, v]) => [u, v]);
    this.calqueAretes.replaceChildren();
    this.calqueSommets.replaceChildren();
    this.calqueEtiquettes.replaceChildren();
    this.sommets.length = 0;
    this.badges.length = 0;
    this.chemins.length = 0;
    this.libellesPoids.length = 0;
    this.calculerCourbures();
    this.aretes.forEach((_, i) => this.creerArete(i));
    this.pos.forEach((_, i) => this.creerSommet(i));
  }

  deplacer(i: number, p: Point) {
    this.pos[i] = [p[0], p[1]];
    this.sommets[i].setAttribute('transform', `translate(${p[0]} ${p[1]})`);
    this.aretes.forEach(([u, v], k) => {
      if (u === i || v === i) {
        this.chemins[k].setAttribute('d', this.dArete(k));
        const g = this.libellesPoids[k];
        if (g) {
          const [mx, my] = this.milieu(k);
          g.setAttribute('transform', `translate(${mx} ${my})`);
        }
      }
    });
  }

  badge(i: number, texte: string | null) {
    const b = this.badges[i];
    if (!b) return;
    b.classList.toggle('visible', texte !== null);
    if (texte !== null) b.querySelector('text')!.textContent = texte;
  }

  classeSommet(i: number, classe: string, actif: boolean) {
    this.sommets[i]?.classList.toggle(classe, actif);
  }

  classeArete(i: number, classe: string, actif: boolean) {
    this.chemins[i]?.classList.toggle(classe, actif);
  }

  /** Trace animée d'une arête parcourue, dans le sens du parcours. */
  tracer(i: number, depuis: number, classe = 'trace'): SVGPathElement {
    const p = svg('path', { d: this.dArete(i, depuis), class: classe });
    this.calqueTraces.append(p);
    const l = p.getTotalLength?.() ?? 200;
    p.style.strokeDasharray = `${l}`;
    p.style.strokeDashoffset = `${l}`;
    requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = '0')));
    return p;
  }

  effacerTraces() {
    this.calqueTraces.replaceChildren();
  }

  /** Coordonnées dans le repère du plateau. */
  point(ev: PointerEvent): Point {
    const m = this.racine.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  sommetSous(p: Point, tolerance = RAYON + 14, saufs: number[] = []): number {
    let meilleur = -1;
    let dm = tolerance;
    this.pos.forEach(([x, y], i) => {
      if (saufs.includes(i)) return;
      const d = Math.hypot(x - p[0], y - p[1]);
      if (d < dm) {
        dm = d;
        meilleur = i;
      }
    });
    return meilleur;
  }

  areteSous(p: Point, tolerance = 16, filtre?: (i: number) => boolean): number {
    let meilleur = -1;
    let dm = tolerance;
    this.aretes.forEach(([u, v], i) => {
      if (filtre && !filtre(i)) return;
      const [cx, cy] = this.controle(i);
      const [x1, y1] = this.pos[u];
      const [x2, y2] = this.pos[v];
      for (let k = 1; k < 20; k++) {
        const t = k / 20;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        const x = a * x1 + b * cx + c * x2;
        const y = a * y1 + b * cy + c * y2;
        const d = Math.hypot(x - p[0], y - p[1]);
        if (d < dm) {
          dm = d;
          meilleur = i;
        }
      }
    });
    return meilleur;
  }
}
