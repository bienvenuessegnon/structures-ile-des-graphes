import { svg } from './dom';
import * as E from './maths/ensembles';
import type { Point } from './niveaux';
import { Partie, type FicheNiveau } from './partie';
import { cleSous, Plateau, texte } from './plateau';

export type NiveauFamille = FicheNiveau & {
  type: 'famille';
  mode: 'topologie' | 'tribu';
  n: number;
  lettres: string[];
  nomPlein: string;
  graines: number[];
};

/** Disposition des points d'une partie dans une tuile (2 × 2). */
const MINI: Point[] = [[-15, -13], [15, -13], [-15, 13], [15, 13]];

/** Construire une topologie ou une tribu en cochant des parties de l'ensemble. */
export class PartieFamille extends Partie<NiveauFamille, Plateau> {
  famille = new Set<number>();
  tuiles = new Map<number, SVGGElement>();
  ordre: number[] = [];
  monter() {
    const { n } = this.niveau;
    this.scene = new Plateau(`famille famille-${this.niveau.mode}`);
    this.ordre = Array.from({ length: 1 << n }, (_, i) => i).sort((a, b) => E.cardinal(a) - E.cardinal(b) || this.lexico(a, b));
    const calque = this.scene.calque();
    this.ordre.forEach((m, k) => {
      const x = 16 + (k % 4) * 83 + 37;
      const y = 14 + Math.floor(k / 4) * 110 + 50;
      const t = svg('g', { class: 'tuile', 'data-cle': m, transform: `translate(${x} ${y})` },
        svg('rect', { class: 'cadre', x: -37, y: -48, width: 74, height: 100, rx: 14 }),
        svg('rect', { class: 'ensemble', x: -29, y: -37, width: 58, height: 50, rx: 12 }));
      for (let i = 0; i < n; i++) {
        const [px, py] = MINI[i];
        t.append(svg('circle', { class: m & (1 << i) ? 'membre' : 'absent', cx: px, cy: py - 12, r: 6.5 }));
      }
      t.append(texte(0, 32, E.nomPartie(m, n, this.niveau.lettres, this.niveau.nomPlein), 'nom-partie'));
      this.tuiles.set(m, t);
      calque.append(t);
    });
    this.recommencer();
  }
  private lexico(a: number, b: number) {
    for (let i = 0; i < this.niveau.n; i++) {
      const x = a & (1 << i), y = b & (1 << i);
      if (x !== y) return x ? -1 : 1;
    }
    return 0;
  }
  private imposees() {
    const p = E.plein(this.niveau.n);
    return new Set([0, p, ...this.niveau.graines]);
  }
  recommencer() {
    this.famille = this.imposees();
    for (const [m, t] of this.tuiles) {
      t.classList.toggle('choisie', this.famille.has(m));
      t.classList.toggle('imposee', this.imposees().has(m));
    }
    this.maj();
  }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    const m = +c;
    if (this.imposees().has(m)) {
      this.hote.statut(m === 0 || m === E.plein(this.niveau.n) ? 'L’ensemble vide et l’ensemble entier sont toujours là.' : 'Les parties de départ restent dans la famille.');
      return;
    }
    if (this.famille.has(m)) this.famille.delete(m);
    else this.famille.add(m);
    this.tuiles.get(m)!.classList.toggle('choisie', this.famille.has(m));
    this.compter();
    this.maj();
  }
  private maj() {
    const { n, lettres, nomPlein, mode } = this.niveau;
    const nom = (m: number) => E.nomPartie(m, n, lettres, nomPlein);
    for (const t of this.tuiles.values()) t.classList.remove('impliquee');
    const d = mode === 'topologie' ? E.defautTopologie(this.famille, n) : E.defautTribu(this.famille, n);
    const nb = this.famille.size;
    if (!d) {
      this.hote.statut(`${mode === 'topologie' ? 'Topologie' : 'Tribu'} à ${nb} parties.`, 'succes');
      return this.gagner();
    }
    if (d.genre === 'union' || d.genre === 'inter') {
      this.tuiles.get(d.a)!.classList.add('impliquee');
      this.tuiles.get(d.b)!.classList.add('impliquee');
      const op = d.genre === 'union' ? '∪' : '∩';
      this.hote.statut(`${nom(d.a)} ${op} ${nom(d.b)} n’est pas dans la famille.`, this.coups ? 'alerte' : 'neutre');
    } else if (d.genre === 'complement') {
      this.tuiles.get(d.a)!.classList.add('impliquee');
      this.hote.statut(`Le complémentaire de ${nom(d.a)} n’est pas dans la famille.`, this.coups ? 'alerte' : 'neutre');
    }
  }
}
