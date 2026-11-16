import { el, svg } from './dom';
import type { Point } from './niveaux';
import type { Surface } from './partie';
import { HAUTEUR, LARGEUR } from './scene';

/** Plateau SVG libre, dans le même repère 360 × 460 que les graphes. */
export class Plateau implements Surface {
  readonly racine: SVGSVGElement;
  constructor(classe = '') {
    this.racine = svg('svg', {
      viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`,
      class: `plateau ${classe}`.trim(),
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
    });
  }
  calque(classe = ''): SVGGElement {
    const g = svg('g', { class: classe || undefined });
    this.racine.append(g);
    return g;
  }
  point(ev: PointerEvent): Point {
    const m = this.racine.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
}

export function texte(x: number, y: number, contenu: string, classe = '', ancre: 'start' | 'middle' | 'end' = 'middle'): SVGTextElement {
  const t = svg('text', { x, y, class: classe || undefined, 'text-anchor': ancre, 'dominant-baseline': 'central' });
  t.textContent = contenu;
  return t;
}

/** Élément porteur d'une clé, sous le doigt. */
export function cleSous(cible: Element | null, attribut = 'data-cle'): string | null {
  return cible?.closest(`[${attribut}]`)?.getAttribute(attribut) ?? null;
}

/** Bouton d'action placé sous le plateau. */
export function bouton(libelle: string, action: () => void, classe = 'secondaire'): HTMLButtonElement {
  const b = el('button', { class: `bouton ${classe}`, type: 'button' }, libelle);
  b.addEventListener('click', action);
  return b;
}

/** Sélecteur numérique − valeur + . */
export function selecteur(nom: string, min: number, max: number, depart: number, change: (v: number) => void) {
  let v = depart;
  const valeur = el('output', { class: 'valeur' }, String(v));
  const moins = el('button', { class: 'pas-bouton', type: 'button', 'aria-label': `${nom} moins un` }, '−');
  const plus = el('button', { class: 'pas-bouton', type: 'button', 'aria-label': `${nom} plus un` }, '+');
  const racine = el('div', { class: 'selecteur', role: 'group', 'aria-label': nom }, el('span', { class: 'nom-selecteur' }, nom), moins, valeur, plus);
  const regler = (x: number, notifier = true) => {
    v = Math.max(min, Math.min(max, x));
    valeur.textContent = String(v).replace('-', '−');
    moins.disabled = v <= min;
    plus.disabled = v >= max;
    if (notifier) change(v);
  };
  moins.addEventListener('click', () => v > min && regler(v - 1));
  plus.addEventListener('click', () => v < max && regler(v + 1));
  regler(v, false);
  return { racine, get valeur() { return v; }, regler: (x: number) => regler(x, false) };
}

/** Bandeau « manche k sur n » pour les niveaux en plusieurs temps. */
export function libelleManche(k: number, n: number, consigne: string) {
  return n > 1 ? `${k + 1}/${n} · ${consigne}` : consigne;
}
