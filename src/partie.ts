import type { Point } from './niveaux';

export interface Hote {
  statut(texte: string, ton?: 'neutre' | 'alerte' | 'succes'): void;
  coups(n: number): void;
  legende(texte: string | null): void;
  reussite(coups: number): void;
  readonly controles: HTMLElement;
}

/** Ce que tout niveau, quelle que soit l'île, sait décrire. */
export interface FicheNiveau {
  id: string;
  type: string;
  titre: string;
  notion: string;
  enonce: string;
  explication: string[];
  /** Libellé de ce que l'on compte pour les étoiles. */
  libelleCoups: string;
  /** Seuils : coups ≤ s[0] → 3 étoiles, coups ≤ s[1] → 2 étoiles, sinon 1. */
  seuils: [number, number];
}

/** Surface de jeu : un SVG et la conversion des coordonnées du pointeur. */
export interface Surface {
  readonly racine: SVGSVGElement;
  point(ev: PointerEvent): Point;
}

export const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const mouvementReduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export abstract class Partie<N extends FicheNiveau = FicheNiveau, S extends Surface = Surface> {
  scene!: S;
  coups = 0;
  fini = false;
  protected appuye = false;

  constructor(protected niveau: N, protected hote: Hote) {}

  abstract monter(): void;
  abstract recommencer(): void;
  protected appui(_p: Point, _cible: Element | null): void {}
  protected glisse(_p: Point): void {}
  protected relache(_p: Point): void {}
  /** Animation jouée après la réussite, avant la fiche. */
  async apresReussite(): Promise<void> {}

  brancher() {
    const r = this.scene.racine;
    r.addEventListener('pointerdown', (e) => {
      if (this.fini) return;
      e.preventDefault();
      this.appuye = true;
      const cible = e.target instanceof Element ? e.target : null;
      r.setPointerCapture(e.pointerId);
      this.appui(this.scene.point(e), cible);
    });
    r.addEventListener('pointermove', (e) => {
      if (!this.appuye || this.fini) return;
      this.glisse(this.scene.point(e));
    });
    const fin = (e: PointerEvent) => {
      if (!this.appuye) return;
      this.appuye = false;
      if (!this.fini) this.relache(this.scene.point(e));
    };
    r.addEventListener('pointerup', fin);
    r.addEventListener('pointercancel', fin);
  }

  protected compter(n = 1) {
    this.coups += n;
    this.hote.coups(this.coups);
  }

  protected gagner() {
    if (this.fini) return;
    this.fini = true;
    this.scene.racine.classList.add('resolu');
    this.hote.reussite(this.coups);
  }
}

export type ConstructeurPartie = new (n: any, h: Hote) => Partie<any, any>;
