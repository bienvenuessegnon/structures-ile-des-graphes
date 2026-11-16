const NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...enfants: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...enfants: (Node | null | undefined)[]
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== false) e.setAttribute(k, String(v));
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}

/** Icônes au trait, dessinées à la main sur une grille de 24. */
const ICONES: Record<string, string> = {
  retour: '<path d="M15 18l-6-6 6-6"/>',
  recommencer: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  annuler: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  cadenas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  suivant: '<path d="M9 18l6-6-6-6"/>',
  sommet: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  arete: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 16l8-8"/>',
  deplacer: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  gomme: '<path d="M20 20H9L4 15a2 2 0 0 1 0-2.8l8.2-8.2a2 2 0 0 1 2.8 0L20 9a2 2 0 0 1 0 2.8L12 20"/>',
  vider: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  'ile-graphes': '<circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8.4 7h7.2M7.2 9.1l3.6 6.8M16.8 9.1l-3.6 6.8"/>',
  'ile-algebre': '<path d="M12 4.5l7 12.5H5z"/><path d="M20.5 8.5a9 9 0 0 0-5-5.2"/><path d="M15.2 1.8l.3 1.5-1.5.4"/>',
  'ile-topologie': '<path d="M3 17l4.5-8 4.5 8 4.5-8L21 17"/><circle cx="7.5" cy="9" r="1.6"/><circle cx="16.5" cy="9" r="1.6"/>',
  'ile-tribus': '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M10 3.5v17M10 12h10.5"/>',
  'ile-vectoriel': '<path d="M4 20l7-3 9-13-7 3z" opacity=".35"/><path d="M4 20l7-3M4 20l9-13"/><path d="M8.6 16.1l2.4.9-1.4 2.1M10.9 7.3l2.1-.3-.2 2.4"/>',
  bac: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><circle cx="15.5" cy="15" r="1.6"/><path d="M9.8 10.2l4.4 3.6"/>',
};

export function icone(nom: string, taille = 20): SVGSVGElement {
  const s = svg('svg', {
    viewBox: '0 0 24 24',
    width: taille,
    height: taille,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: 'icone',
  });
  s.innerHTML = ICONES[nom] ?? '';
  return s;
}

export function etoile(pleine: boolean, taille = 16): SVGSVGElement {
  const s = svg('svg', { viewBox: '0 0 24 24', width: taille, height: taille, class: pleine ? 'etoile pleine' : 'etoile' });
  s.innerHTML =
    '<path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" stroke-linejoin="round"/>';
  return s;
}

export function rangeeEtoiles(n: number, taille = 14): HTMLElement {
  return el('span', { class: 'etoiles', 'aria-label': `${n} étoile${n > 1 ? 's' : ''} sur 3` }, ...[0, 1, 2].map((i) => etoile(i < n, taille)));
}
