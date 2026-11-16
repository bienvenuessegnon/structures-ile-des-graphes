import { el, svg } from './dom';
import * as G from './graphe';
import type { Niveau, Point } from './niveaux';
import { attendre, mouvementReduit, Partie, type ConstructeurPartie } from './partie';
import { Scene } from './scene';

function montrerDegres(scene: Scene) {
  const d = G.degres(scene.pos.length, scene.aretes);
  d.forEach((x, i) => {
    scene.badge(i, String(x));
    scene.classeSommet(i, 'impair', x % 2 === 1);
  });
}

/* 1. Arbre couvrant */
class PartieArbre extends Partie<Niveau, Scene> {
  construites = new Set<number>();
  monter() {
    const n = this.niveau as Extract<Niveau, { type: 'arbre' }>;
    this.scene = new Scene(n.positions, n.candidates);
    this.scene.chemins.forEach((c) => c.classList.add('candidate'));
    this.majStatut();
  }
  recommencer() {
    this.construites.clear();
    this.scene.chemins.forEach((c) => c.classList.remove('construite', 'cycle'));
    this.majStatut();
  }
  protected appui(p: Point) {
    const i = this.scene.areteSous(p, 18);
    if (i < 0) return;
    if (this.construites.has(i)) {
      this.construites.delete(i);
      this.scene.classeArete(i, 'construite', false);
      this.majStatut('Route retirée.');
      return;
    }
    const N = this.scene.pos.length;
    const avant = [...this.construites].map((k) => this.scene.aretes[k]);
    const cycle = G.composantes(N, avant);
    const [u, v] = this.scene.aretes[i];
    this.construites.add(i);
    this.scene.classeArete(i, 'construite', true);
    this.compter();
    if (cycle[u] === cycle[v]) {
      this.scene.classeArete(i, 'cycle', true);
      setTimeout(() => this.scene.classeArete(i, 'cycle', false), 900);
      this.majStatut('Cette route ferme un cycle : ces villages étaient déjà reliés.', 'alerte');
    } else this.majStatut();
    const aretes = [...this.construites].map((k) => this.scene.aretes[k]);
    if (G.estConnexe(N, aretes)) this.gagner();
  }
  private majStatut(texte?: string, ton: 'neutre' | 'alerte' = 'neutre') {
    const N = this.scene.pos.length;
    const k = G.nombreComposantes(N, [...this.construites].map((i) => this.scene.aretes[i]));
    this.hote.statut(texte ?? (k === 1 ? 'Tous les villages sont reliés.' : `${k} groupes de villages isolés.`), ton);
  }
}

/* 2–3. Chemin eulérien */
class PartieEuler extends Partie<Niveau, Scene> {
  chemin: number[] = [];
  utilisees = new Set<number>();
  bouton!: HTMLButtonElement;
  get n() {
    return this.niveau as Extract<Niveau, { type: 'euler' }>;
  }
  monter() {
    this.scene = new Scene(this.n.positions, this.n.aretes, { multi: true, etiquettes: this.n.etiquettes });
    if (this.n.decor === 'riviere') {
      this.scene.fond.append(
        svg('path', {
          class: 'riviere',
          d: 'M-20 170 C 60 150, 110 175, 180 160 S 300 150, 380 185 M-20 305 C 60 325, 120 300, 190 315 S 300 330, 380 290',
        }),
      );
    }
    this.bouton = el('button', { class: 'bouton secondaire', type: 'button' }, 'C’est impossible');
    this.bouton.addEventListener('click', () => this.declarerImpossible());
    this.hote.controles.append(this.bouton);
    this.hote.statut('Posez le doigt sur un sommet pour commencer.');
  }
  recommencer(compte = true) {
    if (this.chemin.length > 0 && compte) this.compter();
    this.chemin = [];
    this.utilisees.clear();
    this.scene.effacerTraces();
    this.scene.sommets.forEach((_, i) => this.scene.classeSommet(i, 'courant', false));
    this.scene.chemins.forEach((c) => c.classList.remove('parcourue'));
    this.hote.statut('Posez le doigt sur un sommet pour commencer.');
  }
  private declarerImpossible() {
    if (this.fini) return;
    if (!this.n.possible) {
      montrerDegres(this.scene);
      this.gagner();
    } else {
      this.compter();
      this.hote.statut('Ce tracé existe bel et bien. Cherchez encore.', 'alerte');
    }
  }
  private aller(v: number) {
    const u = this.chemin[this.chemin.length - 1];
    const i = this.scene.aretes.findIndex(
      ([a, b], k) => !this.utilisees.has(k) && ((a === u && b === v) || (a === v && b === u)),
    );
    if (i < 0) return;
    this.utilisees.add(i);
    this.scene.classeArete(i, 'parcourue', true);
    this.scene.tracer(i, u);
    this.scene.classeSommet(u, 'courant', false);
    this.scene.classeSommet(v, 'courant', true);
    this.chemin.push(v);
    const reste = this.scene.aretes.length - this.utilisees.size;
    if (reste === 0) {
      this.hote.statut('Toutes les arêtes sont parcourues.', 'succes');
      if (this.n.possible) {
        montrerDegres(this.scene);
        this.gagner();
      }
      return;
    }
    const bloque = !this.scene.aretes.some(([a, b], k) => !this.utilisees.has(k) && (a === v || b === v));
    if (bloque) this.hote.statut(`Impasse : il reste ${reste} arête${reste > 1 ? 's' : ''}. Recommencez.`, 'alerte');
    else this.hote.statut(`Encore ${reste} arête${reste > 1 ? 's' : ''}.`);
  }
  protected appui(p: Point) {
    const v = this.scene.sommetSous(p);
    if (v < 0) return;
    if (this.chemin.length === 0) {
      this.chemin = [v];
      this.scene.classeSommet(v, 'courant', true);
      this.hote.statut('Glissez ou touchez un sommet voisin.');
    } else if (v !== this.chemin[this.chemin.length - 1]) this.aller(v);
  }
  protected glisse(p: Point) {
    if (!this.chemin.length) return;
    const v = this.scene.sommetSous(p, 20);
    if (v >= 0 && v !== this.chemin[this.chemin.length - 1]) this.aller(v);
  }
}

/* 4. Coloration */
const TEINTES = ['teinte-0', 'teinte-1', 'teinte-2', 'teinte-3'];
class PartieColoration extends Partie<Niveau, Scene> {
  couleurs: number[] = [];
  choisie = 0;
  get n() {
    return this.niveau as Extract<Niveau, { type: 'coloration' }>;
  }
  monter() {
    this.scene = new Scene(this.n.positions, this.n.aretes);
    this.couleurs = new Array(this.n.positions.length).fill(-1);
    const palette = el('div', { class: 'palette', role: 'radiogroup', 'aria-label': 'Couleurs' });
    for (let c = 0; c < this.n.k; c++) {
      const b = el('button', { class: `pastille ${TEINTES[c]}`, type: 'button', role: 'radio', 'aria-label': `Couleur ${c + 1}` });
      b.addEventListener('click', () => {
        this.choisie = c;
        palette.querySelectorAll('.pastille').forEach((x, k) => x.setAttribute('aria-checked', String(k === c)));
      });
      b.setAttribute('aria-checked', String(c === 0));
      palette.append(b);
    }
    this.hote.controles.append(palette);
    this.maj();
  }
  recommencer() {
    this.couleurs.fill(-1);
    this.scene.sommets.forEach((_, i) => TEINTES.forEach((t) => this.scene.classeSommet(i, t, false)));
    this.maj();
  }
  protected appui(p: Point) {
    const v = this.scene.sommetSous(p);
    if (v < 0) return;
    if (this.couleurs[v] === this.choisie) return;
    this.couleurs[v] = this.choisie;
    TEINTES.forEach((t, k) => this.scene.classeSommet(v, t, k === this.choisie));
    this.compter();
    this.maj();
    if (G.colorationValide(this.n.aretes, this.couleurs)) this.gagner();
  }
  private maj() {
    let conflits = 0;
    this.n.aretes.forEach(([u, v], i) => {
      const c = this.couleurs[u] >= 0 && this.couleurs[u] === this.couleurs[v];
      if (c) conflits++;
      this.scene.classeArete(i, 'conflit', c);
    });
    const restants = this.couleurs.filter((c) => c < 0).length;
    if (conflits) this.hote.statut(`${conflits} arête${conflits > 1 ? 's relient' : ' relie'} deux sommets de même couleur.`, 'alerte');
    else if (restants) this.hote.statut(`${restants} sommet${restants > 1 ? 's' : ''} à colorier.`);
    else this.hote.statut('Coloration valide.', 'succes');
  }
}

/* 5. Biparti */
class PartieBiparti extends Partie<Niveau, Scene> {
  camps: number[] = [];
  get n() {
    return this.niveau as Extract<Niveau, { type: 'biparti' }>;
  }
  monter() {
    this.scene = new Scene(this.n.positions, this.n.aretes);
    this.camps = new Array(this.n.positions.length).fill(-1);
    this.hote.controles.append(
      el('div', { class: 'legende-camps' },
        el('span', { class: 'puce teinte-0' }), 'Camp A',
        el('span', { class: 'puce teinte-1' }), 'Camp B'),
    );
    this.maj();
  }
  recommencer() {
    this.camps.fill(-1);
    this.scene.sommets.forEach((_, i) => TEINTES.forEach((t) => this.scene.classeSommet(i, t, false)));
    this.maj();
  }
  protected appui(p: Point) {
    const v = this.scene.sommetSous(p);
    if (v < 0) return;
    this.camps[v] = this.camps[v] === 0 ? 1 : 0;
    this.scene.classeSommet(v, 'teinte-0', this.camps[v] === 0);
    this.scene.classeSommet(v, 'teinte-1', this.camps[v] === 1);
    this.compter();
    this.maj();
    if (G.colorationValide(this.n.aretes, this.camps)) this.gagner();
  }
  private maj() {
    let conflits = 0;
    this.n.aretes.forEach(([u, v], i) => {
      const c = this.camps[u] >= 0 && this.camps[u] === this.camps[v];
      if (c) conflits++;
      this.scene.classeArete(i, 'conflit', c);
    });
    const restants = this.camps.filter((c) => c < 0).length;
    if (conflits) this.hote.statut(`${conflits} arête${conflits > 1 ? 's restent' : ' reste'} à l’intérieur d’un camp.`, 'alerte');
    else if (restants) this.hote.statut(`${restants} sommet${restants > 1 ? 's' : ''} sans camp.`);
    else this.hote.statut('Bipartition valide.', 'succes');
  }
}

/* 6. Plus court chemin */
class PartieDijkstra extends Partie<Niveau, Scene> {
  chemin: number[] = [];
  aretesChemin: number[] = [];
  get n() {
    return this.niveau as Extract<Niveau, { type: 'dijkstra' }>;
  }
  monter() {
    const n = this.n;
    this.scene = new Scene(n.positions, n.aretes.map(([u, v]) => [u, v]), {
      etiquettes: n.etiquettes,
      poids: n.aretes.map((a) => a[2]),
    });
    this.scene.classeSommet(n.source, 'extremite', true);
    this.scene.classeSommet(n.cible, 'extremite', true);
    this.reinit();
  }
  private cout() {
    return this.aretesChemin.reduce((s, i) => s + this.n.aretes[i][2], 0);
  }
  private reinit() {
    this.chemin = [this.n.source];
    this.aretesChemin = [];
    this.scene.effacerTraces();
    this.scene.sommets.forEach((_, i) => this.scene.classeSommet(i, 'courant', i === this.n.source));
    this.hote.statut('Coût du trajet : 0');
  }
  recommencer() {
    this.reinit();
  }
  protected appui(p: Point) {
    const v = this.scene.sommetSous(p);
    if (v < 0) return;
    const u = this.chemin[this.chemin.length - 1];
    if (this.chemin.length > 1 && v === this.chemin[this.chemin.length - 2]) {
      // retour d'un pas
      this.chemin.pop();
      this.aretesChemin.pop();
      this.scene.calqueTraces.lastChild?.remove();
      this.scene.classeSommet(u, 'courant', false);
      this.scene.classeSommet(v, 'courant', true);
      this.hote.statut(`Coût du trajet : ${this.cout()}`);
      return;
    }
    if (this.chemin.includes(v)) return;
    const i = this.n.aretes.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u));
    if (i < 0) {
      this.hote.statut('Ces deux sommets ne sont pas voisins.', 'alerte');
      return;
    }
    this.chemin.push(v);
    this.aretesChemin.push(i);
    this.scene.tracer(i, u);
    this.scene.classeSommet(u, 'courant', false);
    this.scene.classeSommet(v, 'courant', true);
    const c = this.cout();
    if (v !== this.n.cible) {
      this.hote.statut(`Coût du trajet : ${c}`);
      return;
    }
    const opt = G.dijkstra(this.scene.pos.length, this.n.aretes, this.n.source).dist[this.n.cible];
    if (c === opt) {
      this.hote.statut(`Coût ${c} : c’est le minimum.`, 'succes');
      this.gagner();
    } else {
      this.compter();
      this.hote.statut(`Coût ${c}. Il existe un trajet moins coûteux.`, 'alerte');
      setTimeout(() => !this.fini && this.reinit(), 1400);
    }
  }
  async apresReussite() {
    const n = this.n;
    const N = this.scene.pos.length;
    const { etapes, prec, dist } = G.dijkstra(N, n.aretes, n.source);
    const pause = mouvementReduit() ? 150 : 650;
    await attendre(500);
    this.scene.effacerTraces();
    this.scene.racine.classList.add('analyse');
    this.scene.sommets.forEach((_, i) => this.scene.classeSommet(i, 'courant', false));
    for (const [k, e] of etapes.entries()) {
      this.hote.legende(`Dijkstra, étape ${k + 1} : on fixe ${n.etiquettes![e.sommet]} à la distance ${e.distance}.`);
      this.scene.classeSommet(e.sommet, 'fixe', true);
      e.provisoires.forEach((d, i) => this.scene.badge(i, d === Infinity ? '∞' : String(d)));
      if (prec[e.sommet] >= 0) {
        const p = prec[e.sommet];
        const i = n.aretes.findIndex(([a, b]) => (a === p && b === e.sommet) || (b === p && a === e.sommet));
        this.scene.tracer(i, p, 'trace arbre');
      }
      await attendre(pause);
    }
    const c = G.cheminDepuis(prec, n.cible);
    for (let k = 1; k < c.length; k++) {
      const i = n.aretes.findIndex(([a, b]) => (a === c[k - 1] && b === c[k]) || (b === c[k - 1] && a === c[k]));
      this.scene.tracer(i, c[k - 1]);
    }
    this.hote.legende(`Plus court chemin : ${c.map((x) => n.etiquettes![x]).join(' → ')}, coût ${dist[n.cible]}.`);
    await attendre(pause * 2);
  }
}

/* 7. Chemin hamiltonien */
class PartieHamilton extends Partie<Niveau, Scene> {
  chemin: number[] = [];
  aretesChemin: number[] = [];
  monter() {
    const n = this.niveau as Extract<Niveau, { type: 'hamilton' }>;
    this.scene = new Scene(n.positions, n.aretes);
    const annuler = el('button', { class: 'bouton secondaire', type: 'button' }, 'Annuler le dernier pas');
    annuler.addEventListener('click', () => this.annuler());
    this.hote.controles.append(annuler);
    this.hote.statut('Touchez un sommet pour partir.');
  }
  recommencer() {
    if (this.chemin.length > 1) this.compter();
    this.chemin = [];
    this.aretesChemin = [];
    this.scene.effacerTraces();
    this.scene.sommets.forEach((_, i) => {
      this.scene.classeSommet(i, 'visite', false);
      this.scene.classeSommet(i, 'courant', false);
    });
    this.hote.statut('Touchez un sommet pour partir.');
  }
  private annuler() {
    if (this.fini || !this.chemin.length) return;
    const u = this.chemin.pop()!;
    this.scene.classeSommet(u, 'visite', false);
    this.scene.classeSommet(u, 'courant', false);
    if (this.aretesChemin.length) {
      this.aretesChemin.pop();
      this.scene.calqueTraces.lastChild?.remove();
    }
    const v = this.chemin[this.chemin.length - 1];
    if (v !== undefined) this.scene.classeSommet(v, 'courant', true);
    this.compter();
    this.majStatut();
  }
  private aller(v: number) {
    const N = this.scene.pos.length;
    if (this.chemin.includes(v)) return;
    if (this.chemin.length) {
      const u = this.chemin[this.chemin.length - 1];
      const i = this.scene.aretes.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u));
      if (i < 0) return;
      this.aretesChemin.push(i);
      this.scene.tracer(i, u);
      this.scene.classeSommet(u, 'courant', false);
    }
    this.chemin.push(v);
    this.scene.classeSommet(v, 'visite', true);
    this.scene.classeSommet(v, 'courant', true);
    if (this.chemin.length === N) {
      this.hote.statut('Chaque sommet est visité une fois.', 'succes');
      this.gagner();
      return;
    }
    this.majStatut();
  }
  private majStatut() {
    const N = this.scene.pos.length;
    if (!this.chemin.length) return this.hote.statut('Touchez un sommet pour partir.');
    const v = this.chemin[this.chemin.length - 1];
    const reste = N - this.chemin.length;
    const bloque = !this.scene.aretes.some(
      ([a, b]) => (a === v && !this.chemin.includes(b)) || (b === v && !this.chemin.includes(a)),
    );
    if (bloque) this.hote.statut(`Impasse : ${reste} sommet${reste > 1 ? 's' : ''} non visité${reste > 1 ? 's' : ''}. Annulez un pas.`, 'alerte');
    else this.hote.statut(`Encore ${reste} sommet${reste > 1 ? 's' : ''} à visiter.`);
  }
  protected appui(p: Point) {
    const v = this.scene.sommetSous(p);
    if (v >= 0) this.aller(v);
  }
  protected glisse(p: Point) {
    const v = this.scene.sommetSous(p, 20);
    if (v >= 0) this.aller(v);
  }
}

/* 8. Isomorphisme */
class PartieIsomorphisme extends Partie<Niveau, Scene> {
  place: number[] = [];
  saisi = -1;
  get n() {
    return this.niveau as Extract<Niveau, { type: 'isomorphisme' }>;
  }
  monter() {
    const n = this.n;
    this.place = n.depart.slice();
    this.scene = new Scene(this.place.map((s) => n.positions[s]), n.aretes);
    for (const [u, v] of n.cible) {
      this.scene.fond.append(
        svg('line', { class: 'silhouette', x1: n.positions[u][0], y1: n.positions[u][1], x2: n.positions[v][0], y2: n.positions[v][1] }),
      );
    }
    for (const [x, y] of n.positions) this.scene.fond.append(svg('circle', { class: 'emplacement', cx: x, cy: y, r: 24 }));
    this.maj();
  }
  recommencer() {
    this.place = this.n.depart.slice();
    this.place.forEach((s, i) => this.scene.deplacer(i, this.n.positions[s]));
    this.maj();
  }
  protected appui(p: Point) {
    this.saisi = this.scene.sommetSous(p);
    if (this.saisi >= 0) this.scene.classeSommet(this.saisi, 'saisi', true);
  }
  protected glisse(p: Point) {
    if (this.saisi >= 0) this.scene.deplacer(this.saisi, p);
  }
  protected relache(p: Point) {
    const i = this.saisi;
    if (i < 0) return;
    this.saisi = -1;
    this.scene.classeSommet(i, 'saisi', false);
    const pos = this.n.positions;
    let cible = -1;
    let dm = 40;
    pos.forEach(([x, y], s) => {
      const d = Math.hypot(x - p[0], y - p[1]);
      if (d < dm) {
        dm = d;
        cible = s;
      }
    });
    if (cible >= 0 && cible !== this.place[i]) {
      const j = this.place.indexOf(cible);
      this.place[j] = this.place[i];
      this.place[i] = cible;
      this.scene.deplacer(j, pos[this.place[j]]);
      this.compter();
    }
    this.scene.deplacer(i, pos[this.place[i]]);
    this.maj();
    if (G.superposition(this.n.aretes, this.place, this.n.cible)) this.gagner();
  }
  private maj() {
    const attendu = new Set(this.n.cible.map(([u, v]) => G.cleArete(u, v)));
    let bonnes = 0;
    this.n.aretes.forEach(([u, v], i) => {
      const ok = attendu.has(G.cleArete(this.place[u], this.place[v]));
      if (ok) bonnes++;
      this.scene.classeArete(i, 'alignee', ok);
    });
    const total = this.n.aretes.length;
    this.hote.statut(bonnes === total ? 'Les deux graphes coïncident.' : `${bonnes} arête${bonnes > 1 ? 's' : ''} sur ${total} en place.`, bonnes === total ? 'succes' : 'neutre');
  }
}

export const PARTIES_GRAPHES: Record<string, ConstructeurPartie> = {
  arbre: PartieArbre,
  euler: PartieEuler,
  coloration: PartieColoration,
  biparti: PartieBiparti,
  dijkstra: PartieDijkstra,
  hamilton: PartieHamilton,
  isomorphisme: PartieIsomorphisme,
};
