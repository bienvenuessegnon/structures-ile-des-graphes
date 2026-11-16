import { svg } from '../dom';
import { matrice, type Sym } from '../maths/groupes';

export const TEINTES_COINS = ['teinte-0', 'teinte-1', 'teinte-2', 'teinte-3'];

/** Sommets du n-gone régulier de rayon 1, symétrique par rapport à l'axe vertical. */
export function sommetsPolygone(n: number): [number, number][] {
  const depart = n === 4 ? -Math.PI / 4 : -Math.PI / 2;
  return Array.from({ length: n }, (_, i) => {
    const a = depart + (2 * Math.PI * i) / n;
    return [Math.cos(a), Math.sin(a)];
  });
}

export const transformeSym = (n: number, g: Sym, cx: number, cy: number, r: number) => {
  const [a, b, c, d] = matrice(n, g);
  return `translate(${cx} ${cy}) matrix(${a * r} ${b * r} ${c * r} ${d * r} 0 0)`;
};

/**
 * Figure de référence : polygone, coins colorés et fanion asymétrique.
 * Elle est dessinée dans un repère de rayon 1 ; on la place avec transformeSym.
 */
export function figure(n: number, options: { coins?: boolean; fanion?: boolean } = {}): SVGGElement {
  const s = sommetsPolygone(n);
  const g = svg('g', { class: 'figure' });
  g.append(svg('polygon', { class: 'corps', points: s.map((p) => p.join(',')).join(' ') }));
  if (options.fanion) {
    g.append(
      svg('path', { class: 'mat', d: 'M0.12 0.1 L0.12 -0.52' }),
      svg('path', { class: 'fanion', d: 'M0.12 -0.52 L0.5 -0.4 L0.12 -0.28 Z' }),
    );
  }
  if (options.coins) s.forEach(([x, y], i) => g.append(svg('circle', { class: `coin ${TEINTES_COINS[i]}`, cx: x * 0.78, cy: y * 0.78, r: 0.15 })));
  return g;
}

/** Glyphe d'une symétrie g : la figure dans la position g. */
export function glyphe(n: number, g: Sym, cx: number, cy: number, r: number, options: { coins?: boolean; fanion?: boolean }) {
  const f = figure(n, options);
  f.setAttribute('transform', transformeSym(n, g, cx, cy, r));
  return f;
}

/** Glyphe autonome (pour un bouton). */
export function glypheIcone(n: number, g: Sym, taille: number, options: { coins?: boolean; fanion?: boolean }) {
  const s = svg('svg', { viewBox: '-1.2 -1.2 2.4 2.4', width: taille, height: taille, class: 'glyphe', 'aria-hidden': 'true' });
  s.append(glyphe(n, g, 0, 0, 1, options));
  return s;
}
