import { el, icone } from './dom';
import * as G from './graphe';
import type { Point } from './niveaux';
import { HAUTEUR, LARGEUR, Scene } from './scene';
import { charger, enregistrer } from './stockage';

type Mode = 'construire' | 'deplacer' | 'effacer';

interface Etat {
  pos: Point[];
  aretes: G.Arete[];
}

const EXEMPLE: Etat = {
  pos: [[90, 120], [270, 120], [300, 290], [180, 390], [60, 290]],
  aretes: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2]],
};

/** Bac à sable : on dessine un graphe et on lit ses propriétés en direct. */
export function ecranBac(retour: () => void): HTMLElement {
  const etat: Etat = charger<Etat>('bac', EXEMPLE);
  const scene = new Scene(etat.pos, etat.aretes);
  let mode: Mode = 'construire';
  let selection = -1;
  let saisi = -1;
  let depart: Point | null = null;
  let aBouge = false;
  let camps = false;

  const fiche = el('dl', { class: 'proprietes' });
  const consigne = el('p', { class: 'enonce' });

  const outils: [Mode, string, string][] = [
    ['construire', 'sommet', 'Construire'],
    ['deplacer', 'deplacer', 'Déplacer'],
    ['effacer', 'gomme', 'Effacer'],
  ];
  const barre = el('div', { class: 'outils', role: 'toolbar' });
  const boutonsOutils = outils.map(([m, ic, lib]) => {
    const b = el('button', { class: 'outil', type: 'button', 'aria-pressed': String(m === mode) }, icone(ic, 18), el('span', {}, lib));
    b.addEventListener('click', () => {
      mode = m;
      choisir(-1);
      boutonsOutils.forEach((x, k) => x.setAttribute('aria-pressed', String(outils[k][0] === m)));
      majConsigne();
    });
    barre.append(b);
    return b;
  });
  const vider = el('button', { class: 'outil', type: 'button', 'aria-label': 'Tout effacer' }, icone('vider', 18), el('span', {}, 'Vider'));
  vider.addEventListener('click', () => {
    etat.pos = [];
    etat.aretes = [];
    reconstruire();
  });
  barre.append(vider);

  const basculeCamps = el('button', { class: 'bascule', type: 'button', 'aria-pressed': 'false' }, 'Montrer les camps');
  basculeCamps.addEventListener('click', () => {
    camps = !camps;
    basculeCamps.setAttribute('aria-pressed', String(camps));
    analyser();
  });

  function majConsigne() {
    consigne.textContent = {
      construire: 'Touchez le vide pour ajouter un sommet, puis deux sommets pour les relier.',
      deplacer: 'Faites glisser un sommet pour réorganiser le dessin.',
      effacer: 'Touchez un sommet ou une arête pour le supprimer.',
    }[mode];
  }

  function choisir(i: number) {
    if (selection >= 0) scene.classeSommet(selection, 'courant', false);
    selection = i;
    if (i >= 0) scene.classeSommet(i, 'courant', true);
  }

  function reconstruire() {
    selection = -1;
    scene.reconstruire(etat.pos, etat.aretes);
    analyser();
  }

  function ligne(terme: string, valeur: string, ton = '') {
    fiche.append(el('dt', {}, terme), el('dd', { class: ton }, valeur));
  }

  function analyser() {
    enregistrer('bac', etat);
    const n = etat.pos.length;
    const m = etat.aretes.length;
    const d = G.degres(n, etat.aretes);
    d.forEach((x, i) => scene.badge(i, String(x)));
    const bi = G.bipartition(n, etat.aretes);
    scene.sommets.forEach((_, i) => {
      scene.classeSommet(i, 'teinte-0', camps && !!bi && bi[i] === 0);
      scene.classeSommet(i, 'teinte-1', camps && !!bi && bi[i] === 1);
    });
    fiche.replaceChildren();
    ligne('Ordre', `${n} sommet${n > 1 ? 's' : ''}`);
    ligne('Taille', `${m} arête${m > 1 ? 's' : ''}`);
    if (n) {
      const somme = d.reduce((a, b) => a + b, 0);
      ligne('Somme des degrés', `${somme} = 2 × ${m}`);
      const k = G.nombreComposantes(n, etat.aretes);
      ligne('Connexité', k === 1 ? 'Connexe' : `${k} composantes`, k === 1 ? 'oui' : 'non');
      ligne('Cycle', G.contientCycle(n, etat.aretes) ? 'Contient un cycle' : k === 1 ? 'Aucun : c’est un arbre' : 'Aucun : c’est une forêt');
      const e = G.euler(n, etat.aretes);
      let texteEuler: string;
      if (!m) texteEuler = 'Aucune arête';
      else if (!e.aretesConnexes) texteEuler = 'Non : arêtes en plusieurs morceaux';
      else if (e.cycle) texteEuler = 'Cycle eulérien : tous les degrés sont pairs';
      else if (e.chemin) texteEuler = 'Chemin eulérien seulement : 2 sommets impairs';
      else texteEuler = `Non : ${e.impairs.length} sommets de degré impair`;
      ligne('Euler', texteEuler, e.cycle || e.chemin ? 'oui' : m ? 'non' : '');
      ligne('Biparti', bi ? 'Oui' : 'Non : il existe un cycle impair', bi ? 'oui' : 'non');
    }
    basculeCamps.disabled = !bi || !n;
  }

  const r = scene.racine;
  r.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    r.setPointerCapture(ev.pointerId);
    const p = scene.point(ev);
    depart = p;
    aBouge = false;
    const v = scene.sommetSous(p);
    if (mode === 'effacer') {
      if (v >= 0) {
        etat.pos.splice(v, 1);
        etat.aretes = etat.aretes.filter(([a, b]) => a !== v && b !== v).map(([a, b]) => [a > v ? a - 1 : a, b > v ? b - 1 : b]);
        reconstruire();
      } else {
        const i = scene.areteSous(p);
        if (i >= 0) {
          etat.aretes.splice(i, 1);
          reconstruire();
        }
      }
      return;
    }
    saisi = v;
    if (v >= 0) scene.classeSommet(v, 'saisi', true);
  });
  r.addEventListener('pointermove', (ev) => {
    if (!depart || saisi < 0) return;
    const p = scene.point(ev);
    if (Math.hypot(p[0] - depart[0], p[1] - depart[1]) > 8) aBouge = true;
    if (aBouge && mode === 'deplacer') {
      const q: Point = [Math.max(20, Math.min(LARGEUR - 20, p[0])), Math.max(20, Math.min(HAUTEUR - 20, p[1]))];
      scene.deplacer(saisi, q);
      etat.pos[saisi] = q;
    }
  });
  const relier = (u: number, v: number) => {
    if (u === v || etat.aretes.some(([a, b]) => (a === u && b === v) || (a === v && b === u))) return false;
    etat.aretes.push([u, v]);
    scene.ajouterArete(u, v);
    return true;
  };
  r.addEventListener('pointerup', (ev) => {
    if (!depart) return;
    const p = scene.point(ev);
    const v = saisi;
    depart = null;
    saisi = -1;
    if (v >= 0) scene.classeSommet(v, 'saisi', false);
    if (mode === 'deplacer') {
      if (aBouge) analyser();
      return;
    }
    if (mode !== 'construire') return;
    if (v >= 0 && aBouge) {
      // glisser d'un sommet à un autre : nouvelle arête
      const w = scene.sommetSous(p, 30, [v]);
      if (w >= 0 && relier(v, w)) analyser();
      return;
    }
    if (v >= 0) {
      if (selection >= 0 && selection !== v) {
        relier(selection, v);
        choisir(-1);
        analyser();
      } else choisir(selection === v ? -1 : v);
      return;
    }
    if (selection >= 0) return choisir(-1);
    if (etat.pos.length >= 24) return;
    const q: Point = [Math.max(20, Math.min(LARGEUR - 20, p[0])), Math.max(20, Math.min(HAUTEUR - 20, p[1]))];
    etat.pos.push(q);
    scene.ajouterSommet(q);
    analyser();
  });

  majConsigne();
  analyser();

  const boutonRetour = el('button', { class: 'icone-bouton', type: 'button', 'aria-label': 'Retour à la carte' }, icone('retour'));
  boutonRetour.addEventListener('click', retour);

  return el('main', { class: 'ecran niveau bac' },
    el('header', { class: 'entete' },
      boutonRetour,
      el('div', { class: 'titres' }, el('span', { class: 'surtitre' }, 'Atelier libre'), el('h1', {}, 'Bac à sable')),
      el('span', { class: 'icone-bouton fantome' }),
    ),
    consigne,
    el('div', { class: 'zone-plateau' }, r),
    barre,
    el('section', { class: 'panneau' }, fiche, basculeCamps),
  );
}
