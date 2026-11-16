import { svg } from '../dom';
import { PartieFamille } from '../famille';
import * as E from '../maths/ensembles';
import type { Relief } from '../maths/ensembles';
import { signature } from '../maths/lettres';
import type { Point } from '../niveaux';
import { attendre, Partie, type ConstructeurPartie } from '../partie';
import { bouton, cleSous, libelleManche, Plateau, texte } from '../plateau';
import type { Lettre, NiveauTopologie } from './niveaux';

type N<T extends NiveauTopologie['type']> = Extract<NiveauTopologie, { type: T }>;
const TEINTES = ['teinte-0', 'teinte-1', 'teinte-2', 'teinte-3'];

/** Dessine un relief : liens, puis points (hauts pleins, bas creux). */
export function dessinerRelief(parent: SVGGElement, r: Relief, prefixe = '') {
  const liens = r.liens.map(([b, h]) => {
    const l = svg('line', { class: 'lien-relief', x1: r.points[b][0], y1: r.points[b][1], x2: r.points[h][0], y2: r.points[h][1] });
    parent.append(l);
    return l;
  });
  const points = r.points.map(([x, y], i) => {
    const haut = E.dessus(r, i).length === 0;
    const g = svg('g', { class: `point-relief ${haut ? 'haut' : 'bas'}`, 'data-cle': prefixe + i, transform: `translate(${x} ${y})` },
      svg('circle', { class: 'zone', r: 26 }),
      svg('circle', { class: 'anneau-a', r: 24 }),
      svg('circle', { class: 'disque', r: 17 }),
      texte(0, 0, r.noms?.[i] ?? String(i + 1), 'num'));
    parent.append(g);
    return g;
  });
  return { liens, points };
}

const nomsDe = (r: Relief, m: number) => E.elements(m, r.points.length).map((i) => r.noms?.[i] ?? String(i + 1));
const liste = (l: string[]) => (l.length ? `{${l.join(', ')}}` : '∅');

/* Plus petit ouvert, plus petit fermé */
class PartieVoisinage extends Partie<N<'voisinage'>, Plateau> {
  manche = 0;
  sel = 0;
  dessin!: ReturnType<typeof dessinerRelief>;
  monter() {
    this.scene = new Plateau('relief');
    const c = this.scene.calque();
    this.dessin = dessinerRelief(c, this.niveau.relief);
    this.scene.racine.append(
      texte(180, 112, 'sommets : points ouverts', 'note'),
      texte(180, 352, 'creux : points fermés', 'note'),
    );
    this.debut();
  }
  private get m() { return this.niveau.manches[this.manche]; }
  private requis = () => E.depuis(this.m.requis);
  private cible() {
    const r = this.niveau.relief;
    return this.m.genre === 'ouvert' ? E.ouvertEngendre(r, this.requis()) : E.adherence(r, this.requis());
  }
  private debut() {
    this.sel = this.requis();
    const noms = nomsDe(this.niveau.relief, this.requis());
    const objet = this.m.genre === 'ouvert' ? 'Le plus petit ouvert' : 'Le plus petit fermé';
    this.hote.legende(libelleManche(this.manche, this.niveau.manches.length, `${objet} qui contient ${noms.join(' et ')}`));
    this.maj();
  }
  recommencer() { this.debut(); }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    const i = +c;
    if (this.requis() & (1 << i)) return this.hote.statut('Ce point est imposé.');
    this.sel ^= 1 << i;
    this.compter();
    this.maj();
  }
  private maj() {
    const r = this.niveau.relief;
    this.dessin.points.forEach((p, i) => {
      p.classList.toggle('choisi', !!(this.sel & (1 << i)));
      p.classList.toggle('requis', !!(this.requis() & (1 << i)));
    });
    this.dessin.liens.forEach((l, k) => {
      const [b, h] = r.liens[k];
      l.classList.toggle('dedans', !!(this.sel & (1 << b) && this.sel & (1 << h)));
    });
    const nom = (i: number) => r.noms?.[i] ?? String(i + 1);
    if (this.m.genre === 'ouvert') {
      for (const [b, h] of r.liens) if (this.sel & (1 << b) && !(this.sel & (1 << h)))
        return this.hote.statut(`Pas encore ouvert : ${nom(b)} est choisi, mais pas le sommet ${nom(h)} au-dessus.`, this.coups ? 'alerte' : 'neutre');
    } else {
      for (const [b, h] of r.liens) if (this.sel & (1 << h) && !(this.sel & (1 << b)))
        return this.hote.statut(`Pas encore fermé : ${nom(h)} est choisi, mais pas le creux ${nom(b)} en dessous.`, this.coups ? 'alerte' : 'neutre');
    }
    const genre = this.m.genre === 'ouvert' ? 'ouvert' : 'fermé';
    if (this.sel !== this.cible()) return this.hote.statut(`C’est un ${genre}, mais on peut retirer des points.`);
    this.hote.statut(`${liste(nomsDe(r, this.sel))} : le plus petit ${genre} possible.`, 'succes');
    this.suite();
  }
  private async suite() {
    this.manche++;
    if (this.manche === this.niveau.manches.length) return this.gagner();
    this.fini = true;
    await attendre(1000);
    this.fini = false;
    this.debut();
  }
}

/* Adhérence, intérieur, frontière */
const ETAPES = [
  { nom: 'adhérence', consigne: 'Sélectionnez l’adhérence de A, le plus petit fermé qui le contient.' },
  { nom: 'intérieur', consigne: 'Sélectionnez l’intérieur de A, le plus grand ouvert qu’il contient.' },
  { nom: 'frontière', consigne: 'Sélectionnez la frontière de A : l’adhérence moins l’intérieur.' },
];
class PartieAdherence extends Partie<N<'adherence'>, Plateau> {
  etape = 0;
  sel = 0;
  dessin!: ReturnType<typeof dessinerRelief>;
  monter() {
    this.scene = new Plateau('relief');
    this.dessin = dessinerRelief(this.scene.calque(), this.niveau.relief);
    this.scene.racine.append(texte(180, 112, 'A est cerclée en pointillé', 'note'));
    this.hote.controles.append(bouton('Valider', () => this.valider(), 'principal'));
    this.debut();
  }
  private A = () => E.depuis(this.niveau.partie);
  private attendu() {
    const r = this.niveau.relief;
    return [E.adherence(r, this.A()), E.interieur(r, this.A()), E.frontiere(r, this.A())][this.etape];
  }
  private debut() {
    this.sel = this.etape < 2 ? this.A() : 0;
    this.hote.legende(libelleManche(this.etape, 3, ETAPES[this.etape].consigne));
    this.hote.statut(this.etape < 2 ? 'A est déjà sélectionnée : ajoutez ou retirez des points.' : 'Touchez les points de la frontière.');
    this.maj();
  }
  recommencer() { this.debut(); }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    this.sel ^= 1 << +c;
    this.maj();
  }
  private maj() {
    this.dessin.points.forEach((p, i) => {
      p.classList.toggle('choisi', !!(this.sel & (1 << i)));
      p.classList.toggle('dans-a', !!(this.A() & (1 << i)));
    });
    const r = this.niveau.relief;
    this.dessin.liens.forEach((l, k) => {
      const [b, h] = r.liens[k];
      l.classList.toggle('dedans', !!(this.sel & (1 << b) && this.sel & (1 << h)));
    });
  }
  private async valider() {
    if (this.fini) return;
    const r = this.niveau.relief;
    const a = this.attendu();
    if (this.sel === a) {
      this.hote.statut(`${ETAPES[this.etape].nom[0].toUpperCase() + ETAPES[this.etape].nom.slice(1)} de A : ${liste(nomsDe(r, a))}.`, 'succes');
      this.etape++;
      if (this.etape === 3) return this.gagner();
      this.fini = true;
      await attendre(1100);
      this.fini = false;
      return this.debut();
    }
    this.compter();
    const manque = a & ~this.sel;
    const trop = this.sel & ~a;
    const nom = (m: number) => nomsDe(r, m)[0];
    this.hote.statut(manque ? `Il manque au moins un point, par exemple ${nom(manque)}.` : `Le point ${nom(trop)} est en trop.`, 'alerte');
  }
}

/* Connexité : couper en deux */
class PartieCoupure extends Partie<N<'coupure'>, Plateau> {
  manche = 0;
  retires = 0;
  calque!: SVGGElement;
  dessin!: ReturnType<typeof dessinerRelief>;
  monter() {
    this.scene = new Plateau('relief coupure');
    this.calque = this.scene.calque();
    this.debut();
  }
  private get r() { return this.niveau.manches[this.manche].relief; }
  private debut() {
    this.retires = 0;
    this.calque.replaceChildren();
    this.dessin = dessinerRelief(this.calque, this.r);
    this.hote.legende(libelleManche(this.manche, this.niveau.manches.length, this.niveau.manches[this.manche].nom));
    this.maj();
  }
  recommencer() { this.debut(); }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    const i = +c;
    this.retires ^= 1 << i;
    if (this.retires & (1 << i)) this.compter();
    this.maj();
  }
  private maj() {
    const r = this.r;
    const garde = E.plein(r.points.length) & ~this.retires;
    const comps = E.composantesRelief(r, garde);
    this.dessin.points.forEach((p, i) => {
      p.classList.toggle('retire', !!(this.retires & (1 << i)));
      const k = comps.findIndex((m) => m & (1 << i));
      TEINTES.forEach((t, j) => p.classList.toggle(t, comps.length > 1 && j === k % 4));
    });
    this.dessin.liens.forEach((l, k) => {
      const [b, h] = r.liens[k];
      l.classList.toggle('coupe', !!(this.retires & ((1 << b) | (1 << h))));
    });
    const n = E.cardinal(this.retires);
    if (comps.length >= 2) {
      this.hote.statut(`${comps.length} morceaux, ${n} point${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}.`, 'succes');
      this.suite();
    } else this.hote.statut(n ? `Toujours d’un seul tenant, ${n} point${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}.` : 'Touchez un point pour le retirer.');
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

/* Homéomorphismes : ranger les lettres */
function dessinLettre(l: Lettre, classe = 'lettre') {
  const g = svg('g', { class: classe });
  for (const t of l.traits) g.append(svg('polyline', { points: t.map((p) => p.join(',')).join(' ') }));
  return g;
}
class PartieLettres extends Partie<N<'lettres'>, Plateau> {
  k = 0;
  calqueLettre!: SVGGElement;
  indices!: SVGGElement;
  comptes: SVGTextElement[] = [];
  bacs: SVGGElement[] = [];
  monter() {
    this.scene = new Plateau('lettres');
    this.calqueLettre = this.scene.calque();
    this.indices = this.scene.calque('indices');
    const calque = this.scene.calque();
    this.niveau.modeles.forEach((m, i) => {
      const x = 8 + i * 87;
      const b = svg('g', { class: 'bac-lettres', 'data-cle': i, transform: `translate(${x} 318)` },
        svg('rect', { x: 0, y: 0, width: 82, height: 128, rx: 14 }));
      const d = dessinLettre(m, 'modele');
      d.setAttribute('transform', 'translate(20 14) scale(0.7)');
      b.append(d, texte(41, 92, `comme ${m.nom}`, 'note'));
      const c = texte(41, 112, '', 'compte-bac');
      this.comptes.push(c);
      b.append(c);
      this.bacs.push(b);
      calque.append(b);
    });
    this.recommencer();
  }
  recommencer() {
    this.k = 0;
    this.comptes.forEach((c) => (c.textContent = ''));
    this.montrer();
  }
  private montrer() {
    this.indices.replaceChildren();
    const l = this.niveau.lettres[this.k];
    const d = dessinLettre(l, 'lettre grande');
    d.setAttribute('transform', 'translate(105 40) scale(2.5)');
    this.calqueLettre.replaceChildren(d);
    this.hote.legende(`Lettre ${this.k + 1} sur ${this.niveau.lettres.length}`);
    this.hote.statut(`Où ranger ${l.nom} ?`);
  }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    this.ranger(+c);
  }
  private async ranger(b: number) {
    const l = this.niveau.lettres[this.k];
    if (l.famille !== b) {
      this.compter();
      const s = signature(l.traits);
      const pt = ([x, y]: [number, number], cl: string) => svg('circle', { class: cl, cx: 105 + x * 2.5, cy: 40 + y * 2.5, r: 9 });
      this.indices.replaceChildren(...s.bouts.map((p) => pt(p, 'bout')), ...s.embranchements.map((p) => pt([p[0], p[1]], 'noeud')));
      const nb = s.bouts.length, ne = s.embranchements.length;
      this.hote.statut(`Pas comme ${this.niveau.modeles[b].nom}. ${l.nom} a ${nb} bout${nb > 1 ? 's' : ''} libre${nb > 1 ? 's' : ''}, ${ne} embranchement${ne > 1 ? 's' : ''}${s.boucles ? ' et une boucle' : ''}.`, 'alerte');
      this.bacs[b].classList.add('refus');
      setTimeout(() => this.bacs[b].classList.remove('refus'), 500);
      return;
    }
    const n = this.niveau.lettres.slice(0, this.k + 1).filter((x) => x.famille === b);
    this.comptes[b].textContent = n.map((x) => x.nom).join(' ');
    this.bacs[b].classList.add('accepte');
    setTimeout(() => this.bacs[b].classList.remove('accepte'), 500);
    this.k++;
    if (this.k === this.niveau.lettres.length) {
      this.calqueLettre.replaceChildren();
      this.indices.replaceChildren();
      this.hote.legende(null);
      this.hote.statut('Toutes les lettres sont rangées.', 'succes');
      return this.gagner();
    }
    this.montrer();
  }
}

/* Application continue : faire le tour du cercle */
class PartieContinuite extends Partie<N<'continuite'>, Plateau> {
  f: number[] = [];
  choisi = -1;
  fils!: SVGGElement;
  dep!: ReturnType<typeof dessinerRelief>;
  arr!: ReturnType<typeof dessinerRelief>;
  monter() {
    this.scene = new Plateau('relief continuite');
    this.fils = this.scene.calque('fils');
    this.dep = dessinerRelief(this.scene.calque(), this.niveau.depart, 'x');
    this.arr = dessinerRelief(this.scene.calque(), this.niveau.arrivee, 'y');
    this.arr.points.forEach((p, i) => p.classList.add(TEINTES[i]));
    this.scene.racine.append(texte(16, 30, 'la ligne', 'note', 'start'), texte(16, 250, 'le cercle', 'note', 'start'));
    this.recommencer();
  }
  recommencer() {
    this.f = this.niveau.depart.points.map(() => -1);
    for (const [x, y] of this.niveau.imposes) this.f[x] = y;
    this.choisi = -1;
    this.maj();
  }
  private impose = (x: number) => this.niveau.imposes.some(([a]) => a === x);
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (!c) return;
    const i = +c.slice(1);
    if (c[0] === 'x') {
      if (this.impose(i)) {
        this.hote.statut('Les deux bouts partent de a : c’est un lacet.');
        return;
      }
      this.choisi = this.choisi === i ? -1 : i;
      this.maj();
      if (this.choisi >= 0) this.hote.statut(`Touchez l’image de ${this.niveau.depart.noms![i]} sur le cercle.`);
      return;
    }
    if (this.choisi < 0) return this.hote.statut('Touchez d’abord un point de la ligne.');
    this.f[this.choisi] = i;
    this.choisi = -1;
    this.compter();
    this.maj();
  }
  private maj() {
    const X = this.niveau.depart, Y = this.niveau.arrivee;
    this.fils.replaceChildren();
    this.dep.points.forEach((p, i) => {
      p.classList.toggle('choisi', i === this.choisi);
      TEINTES.forEach((t, k) => p.classList.toggle(t, this.f[i] === k));
    });
    X.points.forEach(([x, y], i) => {
      if (this.f[i] < 0) return;
      const [u, v] = Y.points[this.f[i]];
      this.fils.append(svg('path', { class: `fil ${TEINTES[this.f[i]]}`, d: `M${x} ${y} C ${x} ${y + 90}, ${u} ${v - 110}, ${u} ${v}` }));
    });
    let rupture = '';
    this.dep.liens.forEach((l, k) => {
      const [b, h] = X.liens[k];
      const casse = this.f[b] >= 0 && this.f[h] >= 0 && !E.sous(Y, this.f[b], this.f[h]);
      l.classList.toggle('casse', casse);
      if (casse && !rupture) rupture = `${X.noms![h]} est au-dessus de ${X.noms![b]}, mais ${Y.noms![this.f[h]]} n’est pas au-dessus de ${Y.noms![this.f[b]]}.`;
    });
    if (rupture) return this.hote.statut(`Discontinue : ${rupture}`, 'alerte');
    const libres = this.f.filter((y) => y < 0).length;
    if (libres) return this.choisi < 0 && this.hote.statut(`${libres} point${libres > 1 ? 's' : ''} sans image. Touchez un point de la ligne, puis sa cible.`);
    const manque = Y.points.findIndex((_, k) => !this.f.includes(k));
    if (manque >= 0) return this.hote.statut(`Continue, mais ${Y.noms![manque]} n’est jamais atteint.`, 'alerte');
    this.hote.statut('Continue et surjective : la ligne fait le tour du cercle.', 'succes');
    this.gagner();
  }
}

export const PARTIES_TOPOLOGIE: Record<string, ConstructeurPartie> = {
  famille: PartieFamille,
  voisinage: PartieVoisinage,
  adherence: PartieAdherence,
  coupure: PartieCoupure,
  lettres: PartieLettres,
  continuite: PartieContinuite,
};

