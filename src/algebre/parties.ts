import { el, svg } from '../dom';
import * as Gr from '../maths/groupes';
import type { Sym } from '../maths/groupes';
import type { Point } from '../niveaux';
import { attendre, mouvementReduit, Partie, type ConstructeurPartie } from '../partie';
import { bouton, cleSous, libelleManche, Plateau, selecteur, texte } from '../plateau';
import { figure, glyphe, glypheIcone, sommetsPolygone, TEINTES_COINS } from './glyphes';
import type { NiveauAlgebre } from './niveaux';

type N<T extends NiveauAlgebre['type']> = Extract<NiveauAlgebre, { type: T }>;
const matriceEcran = (m: number[], r: number, cx: number, cy: number) =>
  `translate(${cx} ${cy}) matrix(${m[0] * r} ${m[1] * r} ${m[2] * r} ${m[3] * r} 0 0)`;
const produit = (a: number[], b: number[]) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
];

function arc([cx, cy]: Point, r: number, de: number, a: number) {
  const p = (d: number) => `${(cx + r * Math.cos((d * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((d * Math.PI) / 180)).toFixed(1)}`;
  return `M${p(de)} A ${r} ${r} 0 0 1 ${p(a)}`;
}

/* 1. Symétries du triangle */
class PartieSymetries extends Partie<N<'symetries'>, Plateau> {
  etat: Sym = Gr.neutre;
  manche = 0;
  mot: string[] = [];
  occupe = false;
  forme!: SVGGElement;
  anneaux!: SVGGElement;
  readonly c: Point = [180, 220];
  readonly r = 118;
  monter() {
    const n = this.niveau.n;
    this.scene = new Plateau('symetries');
    const fond = this.scene.calque();
    fond.append(
      svg('line', { class: 'axe', x1: 180, y1: 60, x2: 180, y2: 390 }),
      texte(180, 48, 'axe de s', 'note'),
      svg('path', { class: 'arc-rotation', d: arc(this.c, 152, -60, -14), 'marker-end': 'url(#pointe-arc)' }),
      texte(this.c[0] + 172 * Math.cos(-0.65), this.c[1] + 172 * Math.sin(-0.65), 'r', 'note forte'),
    );
    fond.prepend(svg('defs', {}, svg('marker', { id: 'pointe-arc', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0 0 L10 5 L0 10 z', class: 'pointe' }))));
    this.anneaux = this.scene.calque();
    this.forme = figure(n, { coins: true });
    this.forme.classList.add('grande');
    this.scene.calque().append(this.forme);
    this.hote.controles.append(
      bouton('r · tourner', () => this.jouer(Gr.R), 'principal'),
      bouton('s · retourner', () => this.jouer(Gr.S)),
    );
    this.nouvelleManche();
  }
  private placer(m: number[]) {
    this.forme.setAttribute('transform', matriceEcran(m, this.r, ...this.c));
  }
  private nouvelleManche() {
    const n = this.niveau.n;
    this.etat = Gr.neutre;
    this.mot = [];
    this.placer(Gr.matrice(n, this.etat));
    const cible = this.niveau.cibles[this.manche];
    const m = Gr.matrice(n, cible);
    this.anneaux.replaceChildren(...sommetsPolygone(n).map(([x, y], i) => {
      const X = (m[0] * x + m[2] * y) * 0.78 * this.r + this.c[0];
      const Y = (m[1] * x + m[3] * y) * 0.78 * this.r + this.c[1];
      return svg('circle', { class: `anneau-cible ${TEINTES_COINS[i]}`, cx: X, cy: Y, r: 27 });
    }));
    this.hote.legende(libelleManche(this.manche, this.niveau.cibles.length, 'Chaque coin doit rejoindre l’anneau de sa couleur.'));
    this.hote.statut('Position de départ : e, l’identité.');
  }
  recommencer() {
    if (this.occupe) return;
    this.nouvelleManche();
  }
  private async jouer(g: Sym) {
    if (this.occupe || this.fini) return;
    this.occupe = true;
    const n = this.niveau.n;
    const depart = Gr.matrice(n, this.etat);
    const rotation = g[1] === 0;
    const duree = mouvementReduit() ? 1 : 420;
    const t0 = performance.now();
    await new Promise<void>((fini) => {
      const pas = (t: number) => {
        const u = Math.min(1, (t - t0) / duree);
        const e = 1 - Math.pow(1 - u, 3);
        let a: number[];
        if (rotation) {
          const th = (e * 2 * Math.PI) / n;
          a = [Math.cos(th), Math.sin(th), -Math.sin(th), Math.cos(th)];
        } else a = [1 - 2 * e, 0, 0, 1];
        this.placer(produit(a, depart));
        if (u < 1) requestAnimationFrame(pas);
        else fini();
      };
      requestAnimationFrame(pas);
    });
    this.etat = Gr.compose(n, g, this.etat);
    this.placer(Gr.matrice(n, this.etat));
    this.mot.push(Gr.nomSym(g));
    this.compter();
    this.occupe = false;
    const cible = this.niveau.cibles[this.manche];
    if (Gr.egal(this.etat, cible)) {
      this.hote.statut(`Atteint : ${this.mot.join(' puis ')}.`, 'succes');
      this.manche++;
      if (this.manche === this.niveau.cibles.length) return this.gagner();
      this.occupe = true;
      await attendre(900);
      this.occupe = false;
      if (!this.fini) this.nouvelleManche();
    } else this.hote.statut(`Mouvements : ${this.mot.join(' puis ')}.`);
  }
}

/* 2. Horloge modulaire */
class PartieHorloge extends Partie<N<'horloge'>, Plateau> {
  trouves = new Set<number>();
  essayes = new Set<number>();
  heures: SVGGElement[] = [];
  trace!: SVGGElement;
  jeton = 0;
  readonly c: Point = [180, 222];
  readonly R = 138;
  pos(h: number): Point {
    const a = -Math.PI / 2 + (2 * Math.PI * h) / this.niveau.n;
    return [this.c[0] + this.R * Math.cos(a), this.c[1] + this.R * Math.sin(a)];
  }
  monter() {
    const n = this.niveau.n;
    this.scene = new Plateau('horloge');
    this.scene.calque().append(svg('circle', { class: 'cadran', cx: this.c[0], cy: this.c[1], r: this.R }));
    this.trace = this.scene.calque('orbite');
    const calque = this.scene.calque();
    for (let h = 0; h < n; h++) {
      const [x, y] = this.pos(h);
      const g = svg('g', { class: 'heure', transform: `translate(${x} ${y})`, 'data-cle': h },
        svg('circle', { class: 'zone', r: 26 }), svg('circle', { class: 'disque', r: 18 }), texte(0, 0, String(h), 'num'));
      this.heures.push(g);
      calque.append(g);
    }
    this.scene.calque().append(texte(this.c[0], this.c[1] - 10, 'générateurs', 'note'));
    this.bilan = texte(this.c[0], this.c[1] + 14, '0 sur 4', 'bilan');
    this.scene.racine.append(this.bilan);
    this.maj();
  }
  bilan!: SVGTextElement;
  recommencer() {
    this.jeton++;
    this.trace.replaceChildren();
    this.heures.forEach((h) => h.classList.remove('allumee', 'saut'));
    this.hote.statut('Touchez une heure pour choisir la longueur du saut.');
  }
  private maj() {
    this.bilan.textContent = `${this.trouves.size} sur 4`;
    if (!this.coups && !this.trouves.size) this.hote.statut('Touchez une heure pour choisir la longueur du saut.');
  }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null) return;
    this.sauter(+c);
  }
  private async sauter(k: number) {
    const n = this.niveau.n;
    const jeton = ++this.jeton;
    this.trace.replaceChildren();
    this.heures.forEach((h, i) => {
      h.classList.remove('allumee');
      h.classList.toggle('saut', i === k);
    });
    if (k === 0) return this.hote.statut('Un saut de 0 reste sur place : seule l’heure 0 s’allume.', 'alerte');
    const orbite = [0];
    for (let x = k % n; x !== 0; x = (x + k) % n) orbite.push(x);
    this.heures[0].classList.add('allumee');
    const pause = mouvementReduit() ? 0 : 110;
    for (let i = 1; i <= orbite.length; i++) {
      if (pause) await attendre(pause);
      if (jeton !== this.jeton) return;
      const a = this.pos(orbite[i - 1]);
      const b = this.pos(orbite[i % orbite.length]);
      this.trace.append(svg('line', { class: 'corde', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
      this.heures[orbite[i % orbite.length]].classList.add('allumee');
    }
    if (orbite.length === n) {
      if (!this.trouves.has(k)) {
        this.trouves.add(k);
        this.heures[k].classList.add('generateur');
      }
      this.maj();
      this.hote.statut(`Saut de ${k} : les ${n} heures s’allument. ${k} engendre le groupe.`, 'succes');
      if (this.trouves.size === 4) this.gagner();
    } else {
      if (!this.essayes.has(k)) {
        this.essayes.add(k);
        this.compter();
      }
      this.hote.statut(`Saut de ${k} : ${orbite.length} heures seulement (${orbite.join(', ')}).`, 'alerte');
    }
  }
}

/* 3. Table de Cayley des rotations du carré */
class PartieCayley extends Partie<N<'cayley'>, Plateau> {
  table: number[][] = [];
  choisie = 1;
  cases: SVGGElement[][] = [];
  readonly taille = 64;
  readonly x0 = 22;
  readonly y0 = 36;
  monter() {
    const n = this.niveau.n;
    this.scene = new Plateau('cayley');
    const t = this.taille;
    const calque = this.scene.calque();
    calque.append(texte(this.x0 + t / 2, this.y0 + t / 2, '∘', 'operation'));
    for (let i = 0; i < n; i++) {
      const etiquette = (x: number, y: number) => svg('g', { class: 'entete-table' },
        svg('rect', { x: x + 4, y: y + 4, width: t - 8, height: t - 8, rx: 10 }),
        glyphe(4, [i, 0], x + t / 2, y + t / 2 - 5, 19, { fanion: true }),
        texte(x + t / 2, y + t - 12, `${i * 90}°`, 'degres'));
      calque.append(etiquette(this.x0 + (i + 1) * t, this.y0), etiquette(this.x0, this.y0 + (i + 1) * t));
    }
    for (let i = 0; i < n; i++) {
      this.cases[i] = [];
      for (let j = 0; j < n; j++) {
        const x = this.x0 + (j + 1) * t;
        const y = this.y0 + (i + 1) * t;
        const g = svg('g', { class: 'case', 'data-cle': `${i},${j}`, transform: `translate(${x} ${y})` },
          svg('rect', { x: 3, y: 3, width: t - 6, height: t - 6, rx: 10 }));
        this.cases[i][j] = g;
        calque.append(g);
      }
    }
    this.scene.racine.append(texte(180, 400, 'ligne puis colonne', 'note'));
    const palette = el('div', { class: 'palette', role: 'radiogroup', 'aria-label': 'Rotations' });
    for (let k = 0; k < n; k++) {
      const b = el('button', { class: 'pastille glyphe-bouton', type: 'button', role: 'radio', 'aria-label': `Rotation de ${k * 90} degrés` }, glypheIcone(4, [k, 0], 30, { fanion: true }));
      b.setAttribute('aria-checked', String(k === this.choisie));
      b.addEventListener('click', () => {
        this.choisie = k;
        palette.querySelectorAll('.pastille').forEach((x, m) => x.setAttribute('aria-checked', String(m === k)));
      });
      palette.append(b);
    }
    this.hote.controles.append(palette);
    this.recommencer();
  }
  private vraie = (i: number, j: number) => (i + j) % this.niveau.n;
  recommencer() {
    const n = this.niveau.n;
    this.table = Array.from({ length: n }, () => new Array(n).fill(-1));
    for (const [i, j] of this.niveau.donnees) this.table[i][j] = this.vraie(i, j);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      this.cases[i][j].classList.toggle('donnee', this.table[i][j] >= 0);
      this.dessiner(i, j);
    }
    this.maj();
  }
  private dessiner(i: number, j: number) {
    const g = this.cases[i][j];
    g.querySelector('.figure')?.remove();
    const v = this.table[i][j];
    if (v >= 0) g.append(glyphe(4, [v, 0], this.taille / 2, this.taille / 2, 20, { fanion: true }));
    g.dataset.valeur = String(v);
  }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (!c) return;
    const [i, j] = c.split(',').map(Number);
    if (this.cases[i][j].classList.contains('donnee')) return;
    this.table[i][j] = this.table[i][j] === this.choisie ? -1 : this.choisie;
    if (this.table[i][j] >= 0) this.compter();
    this.dessiner(i, j);
    this.maj();
  }
  private maj() {
    const n = this.niveau.n;
    let conflits = 0;
    let vides = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = this.table[i][j];
      if (v < 0) vides++;
      const c = v >= 0 && (this.table[i].some((w, k) => k !== j && w === v) || this.table.some((l, k) => k !== i && l[j] === v));
      if (c) conflits++;
      this.cases[i][j].classList.toggle('conflit', c);
    }
    if (conflits) return this.hote.statut('Une rotation apparaît deux fois dans une même ligne ou colonne.', 'alerte');
    if (vides) return this.hote.statut(`${vides} case${vides > 1 ? 's' : ''} à remplir.`);
    const juste = this.table.every((l, i) => l.every((v, j) => v === this.vraie(i, j)));
    if (juste) {
      this.hote.statut('Table complète.', 'succes');
      this.gagner();
    } else this.hote.statut('La table est pleine, mais certains enchaînements sont faux.', 'alerte');
  }
}

/* 4. Sous-groupe de D4 */
class PartieSousGroupe extends Partie<N<'sousgroupe'>, Plateau> {
  choix = new Set<number>();
  tuiles: SVGGElement[] = [];
  monter() {
    const n = this.niveau.n;
    this.scene = new Plateau('sousgroupe');
    const calque = this.scene.calque();
    calque.append(texte(180, 64, 'rotations', 'note'), texte(180, 252, 'symétries', 'note'));
    Gr.tous(n).forEach((g, i) => {
      const x = 45 + 90 * (i % n);
      const y = i < n ? 148 : 336;
      const t = svg('g', { class: 'tuile-groupe', 'data-cle': i, transform: `translate(${x} ${y})` },
        svg('rect', { x: -40, y: -66, width: 80, height: 124, rx: 14 }),
        glyphe(n, g, 0, -14, 28, { fanion: true }),
        texte(0, 36, Gr.nomSym(g), 'nom-sym'));
      if (g[1]) {
        // axe de la réflexion r^k s : la droite fixe de la matrice
        const m = Gr.matrice(n, g);
        const ang = Math.abs(m[0] + 1) < 1e-9 && Math.abs(m[1]) < 1e-9 ? Math.PI / 2 : Math.atan2(m[1], m[0] + 1);
        const dx = Math.cos(ang) * 36, dy = Math.sin(ang) * 36;
        t.insertBefore(svg('line', { class: 'axe-mini', x1: -dx, y1: -14 - dy, x2: dx, y2: -14 + dy }), t.children[1]);
      }
      this.tuiles.push(t);
      calque.append(t);
    });
    this.recommencer();
  }
  private impose = () => Gr.indice(this.niveau.n, this.niveau.impose);
  recommencer() {
    this.choix = new Set([this.impose()]);
    this.tuiles.forEach((t, i) => {
      t.classList.toggle('choisie', this.choix.has(i));
      t.classList.toggle('imposee', i === this.impose());
    });
    this.maj();
  }
  protected appui(_p: Point, cible: Element | null) {
    const c = cleSous(cible);
    if (c === null || +c === this.impose()) return;
    const i = +c;
    if (this.choix.has(i)) this.choix.delete(i);
    else this.choix.add(i);
    this.tuiles[i].classList.toggle('choisie', this.choix.has(i));
    this.compter();
    this.maj();
  }
  private maj() {
    const n = this.niveau.n;
    const partie = [...this.choix].map((i) => Gr.elementDe(n, i));
    this.tuiles.forEach((t) => t.classList.remove('manquante'));
    const sortant = Gr.premierProduitSortant(n, partie);
    if (sortant) {
      const [x, y, z] = sortant;
      this.tuiles[Gr.indice(n, z)].classList.add('manquante');
      return this.hote.statut(`${Gr.nomSym(x)} ∘ ${Gr.nomSym(y)} = ${Gr.nomSym(z)}, qui n’est pas dans votre choix.`, this.coups ? 'alerte' : 'neutre');
    }
    if (partie.length !== this.niveau.taille) return this.hote.statut(`Stable par composition, mais ${partie.length} élément${partie.length > 1 ? 's' : ''} au lieu de ${this.niveau.taille}.`);
    this.hote.statut(`Sous-groupe d’ordre ${this.niveau.taille}.`, 'succes');
    this.gagner();
  }
}

/* 5. Une loi non associative */
class PartieAssociativite extends Partie<N<'associativite'>, Plateau> {
  cases: SVGGElement[][] = [];
  lignes!: SVGGElement;
  sel: ReturnType<typeof selecteur>[] = [];
  readonly t = 46;
  readonly x0 = 42;
  readonly y0 = 18;
  monter() {
    const T = this.niveau.table;
    const n = T.length;
    this.scene = new Plateau('associativite');
    const calque = this.scene.calque();
    const t = this.t;
    calque.append(texte(this.x0 + t / 2, this.y0 + t / 2, '⋆', 'operation'));
    for (let i = 0; i < n; i++) {
      calque.append(texte(this.x0 + (i + 1.5) * t, this.y0 + t / 2, String(i), 'entete-num'));
      calque.append(texte(this.x0 + t / 2, this.y0 + (i + 1.5) * t, String(i), 'entete-num'));
      this.cases[i] = [];
      for (let j = 0; j < n; j++) {
        const g = svg('g', { class: 'case-loi', transform: `translate(${this.x0 + (j + 1) * t} ${this.y0 + (i + 1) * t})` },
          svg('rect', { x: 2, y: 2, width: t - 4, height: t - 4, rx: 8 }), texte(t / 2, t / 2, String(T[i][j]), 'num'));
        this.cases[i][j] = g;
        calque.append(g);
      }
    }
    this.lignes = this.scene.calque('calcul');
    const reglages = el('div', { class: 'reglages' });
    this.sel = ['a', 'b', 'c'].map((nom, k) => selecteur(nom, 0, n - 1, 0, () => this.apercu()));
    reglages.append(...this.sel.map((s) => s.racine));
    const tester = bouton('Tester ce triplet', () => this.tester(), 'principal');
    this.hote.controles.classList.add('pile');
    this.hote.controles.append(reglages, tester);
    this.recommencer();
  }
  recommencer() {
    this.lignes.replaceChildren();
    this.surligner([]);
    this.apercu();
  }
  private surligner(cases: [number, number, string][]) {
    this.cases.flat().forEach((c) => c.classList.remove('gauche', 'droite'));
    for (const [i, j, cl] of cases) this.cases[i][j].classList.add(cl);
  }
  private apercu() {
    const [a, b, c] = this.sel.map((s) => s.valeur);
    this.lignes.replaceChildren(texte(180, 322, `a = ${a},  b = ${b},  c = ${c}`, 'calcul-titre'));
    this.surligner([]);
    this.hote.statut('Réglez a, b et c, puis testez.');
  }
  private tester() {
    if (this.fini) return;
    const T = this.niveau.table;
    const [a, b, c] = this.sel.map((s) => s.valeur);
    const ab = T[a][b], g = T[ab][c];
    const bc = T[b][c], d = T[a][bc];
    this.surligner([[a, b, 'gauche'], [ab, c, 'gauche'], [b, c, 'droite'], [a, bc, 'droite']]);
    this.lignes.replaceChildren(
      texte(180, 322, `a = ${a},  b = ${b},  c = ${c}`, 'calcul-titre'),
      texte(180, 360, `(a ⋆ b) ⋆ c = ${ab} ⋆ ${c} = ${g}`, 'calcul gauche'),
      texte(180, 394, `a ⋆ (b ⋆ c) = ${a} ⋆ ${bc} = ${d}`, 'calcul droite'),
      texte(180, 432, g === d ? 'égalité' : `${g} ≠ ${d}`, g === d ? 'verdict' : 'verdict faux'),
    );
    if (g !== d) {
      this.hote.statut(`Témoin trouvé : (${a}, ${b}, ${c}).`, 'succes');
      this.gagner();
    } else {
      this.compter();
      this.hote.statut(a === 0 || b === 0 || c === 0 ? 'Avec le neutre, l’égalité est garantie. Évitez 0.' : 'Ce triplet respecte l’associativité. Essayez-en un autre.', 'alerte');
    }
  }
}

/* 6. Graphe de Cayley de D3 */
class PartieGrapheCayley extends Partie<N<'graphecayley'>, Plateau> {
  gen: Sym = Gr.R;
  pos: Point[] = [];
  noeuds: SVGGElement[] = [];
  liens!: SVGGElement;
  apercu!: SVGLineElement;
  faits = new Set<string>();
  selection = -1;
  monter() {
    const n = this.niveau.n;
    this.scene = new Plateau('graphe-cayley');
    this.scene.racine.append(svg('defs', {},
      svg('marker', { id: 'pointe-r', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' },
        svg('path', { d: 'M0 0 L10 5 L0 10 z', class: 'pointe' }))));
    const elts = Gr.tous(n);
    // e, r, r² sur le grand triangle ; chaque s·g sur le petit, en face de g
    elts.forEach((g) => {
      const partenaire = g[1] ? Gr.compose(n, Gr.S, g) : g;
      const a = -Math.PI / 2 + (2 * Math.PI * partenaire[0]) / n;
      const r = g[1] ? 76 : 162;
      this.pos[Gr.indice(n, g)] = [180 + r * Math.cos(a), 236 + r * Math.sin(a)];
    });
    this.liens = this.scene.calque('liens');
    this.apercu = svg('line', { class: 'apercu-lien' });
    this.scene.racine.append(this.apercu);
    const calque = this.scene.calque();
    elts.forEach((g, i) => {
      const [x, y] = this.pos[i];
      // étiquette vers l'extérieur pour le grand triangle, vers le centre pour le petit
      const [dx, dy] = [180 - x, 236 - y];
      const l = Math.hypot(dx, dy);
      const [ex, ey] = g[1] ? [(dx / l) * 42, (dy / l) * 42] : [0, y < 236 ? -42 : 42];
      const noeud = svg('g', { class: 'noeud-groupe', 'data-cle': i, transform: `translate(${x} ${y})` },
        svg('circle', { class: 'zone', r: 34 }), svg('circle', { class: 'disque', r: 27 }),
        glyphe(n, g, 0, 0, 19, { coins: true }), texte(ex, ey, Gr.nomSym(g), 'nom-sym'));
      this.noeuds.push(noeud);
      calque.append(noeud);
    });
    const palette = el('div', { class: 'palette generateurs', role: 'radiogroup', 'aria-label': 'Générateur' });
    for (const [g, nom] of [[Gr.R, 'r · flèche'], [Gr.S, 's · trait']] as const) {
      const b = el('button', { class: `choix-gen ${g[1] ? 'gen-s' : 'gen-r'}`, type: 'button', role: 'radio', 'aria-checked': String(Gr.egal(g, this.gen)) }, nom);
      b.addEventListener('click', () => {
        this.gen = g;
        palette.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      });
      palette.append(b);
    }
    this.hote.controles.append(palette);
    this.recommencer();
  }
  private total = () => this.niveau.n * 2 + this.niveau.n;
  recommencer() {
    this.faits.clear();
    this.liens.replaceChildren();
    this.choisir(-1);
    this.hote.statut(`Touchez une position, puis celle où mène le générateur. 0 lien sur ${this.total()}.`);
  }
  private choisir(i: number) {
    if (this.selection >= 0) this.noeuds[this.selection].classList.remove('choisi');
    this.selection = i;
    if (i >= 0) this.noeuds[i].classList.add('choisi');
    this.apercu.classList.remove('visible');
  }
  private sous(p: Point) {
    return this.pos.findIndex(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 34);
  }
  protected appui(p: Point) {
    const v = this.sous(p);
    if (v < 0) return this.choisir(-1);
    if (this.selection >= 0 && v !== this.selection) {
      const u = this.selection;
      this.choisir(-1);
      return this.relier(u, v);
    }
    this.choisir(v);
  }
  protected glisse(p: Point) {
    if (this.selection < 0) return;
    const [x, y] = this.pos[this.selection];
    this.apercu.setAttribute('x1', String(x));
    this.apercu.setAttribute('y1', String(y));
    this.apercu.setAttribute('x2', String(p[0]));
    this.apercu.setAttribute('y2', String(p[1]));
    this.apercu.classList.add('visible');
  }
  protected relache(p: Point) {
    this.apercu.classList.remove('visible');
    const v = this.sous(p);
    if (this.selection >= 0 && v >= 0 && v !== this.selection) {
      const u = this.selection;
      this.choisir(-1);
      this.relier(u, v);
    }
  }
  private relier(u: number, v: number) {
    const n = this.niveau.n;
    const g = this.gen;
    const gu = Gr.indice(n, Gr.compose(n, g, Gr.elementDe(n, u)));
    const gv = Gr.indice(n, Gr.compose(n, g, Gr.elementDe(n, v)));
    let de = -1, vers = -1;
    if (gu === v) [de, vers] = [u, v];
    else if (gv === u) [de, vers] = [v, u];
    const nomG = Gr.nomSym(g);
    if (de < 0) {
      this.compter();
      const nu = Gr.nomSym(Gr.elementDe(n, u));
      return this.hote.statut(`${nomG} appliqué à ${nu} donne ${Gr.nomSym(Gr.elementDe(n, gu))}, pas ${Gr.nomSym(Gr.elementDe(n, v))}.`, 'alerte');
    }
    const cle = g[1] ? `s${Math.min(u, v)}-${Math.max(u, v)}` : `r${de}-${vers}`;
    if (this.faits.has(cle)) return this.hote.statut('Ce lien est déjà tracé.');
    this.faits.add(cle);
    const [x1, y1] = this.pos[de];
    const [x2, y2] = this.pos[vers];
    const l = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / l, uy = (y2 - y1) / l;
    const coupe = 33;
    const ligne = svg('line', {
      class: g[1] ? 'lien-s' : 'lien-r',
      x1: x1 + ux * coupe, y1: y1 + uy * coupe, x2: x2 - ux * (coupe + 2), y2: y2 - uy * (coupe + 2),
      'marker-end': g[1] ? undefined : 'url(#pointe-r)',
    });
    this.liens.append(ligne);
    const reste = this.total() - this.faits.size;
    if (!reste) {
      this.hote.statut('Le graphe de Cayley est complet.', 'succes');
      return this.gagner();
    }
    this.hote.statut(`${nomG} · ${Gr.nomSym(Gr.elementDe(n, de))} = ${Gr.nomSym(Gr.elementDe(n, vers))}. Encore ${reste} lien${reste > 1 ? 's' : ''}.`, 'succes');
  }
}

export const PARTIES_ALGEBRE: Record<string, ConstructeurPartie> = {
  symetries: PartieSymetries,
  horloge: PartieHorloge,
  cayley: PartieCayley,
  sousgroupe: PartieSousGroupe,
  associativite: PartieAssociativite,
  graphecayley: PartieGrapheCayley,
};

