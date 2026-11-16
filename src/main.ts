import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import './style.css';
import { ecranBac } from './bac';
import { el, etoile, icone, svg } from './dom';
import { ILES, ile as trouverIle, totalNiveaux, type Ile } from './iles';
import { etoilesPour } from './niveaux';
import type { FicheNiveau, Hote } from './partie';
import { creerPartie } from './registre';
import { noterEtoiles, progression } from './stockage';

const app = document.getElementById('app')!;

function afficher(ecran: HTMLElement) {
  app.replaceChildren(ecran);
  window.scrollTo(0, 0);
}

const GRAPHES = ILES[0];

/** Dans chaque île, un niveau s'ouvre quand le précédent est réussi. Les îles sont toutes ouvertes. */
function debloque(ile: Ile, i: number): boolean {
  if (i === 0) return true;
  return (progression()[ile.niveaux[i - 1].id] ?? 0) > 0;
}

const etoilesIle = (ile: Ile) => ile.niveaux.reduce((s, n) => s + (progression()[n.id] ?? 0), 0);

const ENTIERS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const DIZAINES: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante' };
function enLettres(n: number): string {
  if (n <= 10) return ENTIERS[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 1) return ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'][u];
  return DIZAINES[d] + (u === 0 ? '' : u === 1 ? ' et un' : '-' + ENTIERS[u]);
}

/* Écran titre */
function ecranTitre() {
  const fond = svg('svg', { class: 'constellation', viewBox: '0 0 390 844', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
  let graine = 7;
  const alea = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646;
  // répartition en grille perturbée, plus dense en haut de l'écran
  const points = Array.from({ length: 18 }, (_, i) => ({
    x: 30 + (i % 3) * 130 + alea() * 90,
    y: 40 + Math.floor(i / 3) * 78 + alea() * 50,
    vx: (alea() - 0.5) * 0.22,
    vy: (alea() - 0.5) * 0.22,
  }));
  const liens: [number, number][] = [];
  points.forEach((_, i) => {
    const proches = points
      .map((q, j) => [j, Math.hypot(q.x - points[i].x, q.y - points[i].y)] as const)
      .filter(([j]) => j > i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [j, d] of proches) if (d < 170) liens.push([i, j]);
  });
  const traits = liens.map(() => svg('line', { class: 'lien' }));
  const ronds = points.map(() => svg('circle', { r: 3.2, class: 'point' }));
  fond.append(...traits, ...ronds);
  const animer = () => {
    if (!fond.isConnected) return;
    for (const p of points) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 10 || p.x > 380) p.vx *= -1;
      if (p.y < 10 || p.y > 834) p.vy *= -1;
    }
    liens.forEach(([i, j], k) => {
      traits[k].setAttribute('x1', points[i].x.toFixed(1));
      traits[k].setAttribute('y1', points[i].y.toFixed(1));
      traits[k].setAttribute('x2', points[j].x.toFixed(1));
      traits[k].setAttribute('y2', points[j].y.toFixed(1));
    });
    ronds.forEach((c, i) => {
      c.setAttribute('cx', points[i].x.toFixed(1));
      c.setAttribute('cy', points[i].y.toFixed(1));
    });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(animer);
  };
  requestAnimationFrame(animer);

  const dejaJoue = Object.keys(progression()).length > 0;
  const commencer = el('button', { class: 'bouton principal', type: 'button' }, dejaJoue ? 'Continuer' : 'Commencer');
  commencer.addEventListener('click', () => afficher(ecranArchipel()));

  return el('main', { class: 'ecran titre' },
    fond,
    el('div', { class: 'titre-bloc' },
      el('p', { class: 'surtitre' }, 'Un jeu de mathématiques'),
      el('h1', { class: 'grand-titre' }, 'Structures'),
      el('p', { class: 'sous-titre' }, 'Un archipel mathématique'),
      el('p', { class: 'accroche' }, `${enLettres(ILES.length)[0].toUpperCase() + enLettres(ILES.length).slice(1)} îles et ${enLettres(totalNiveaux)} épreuves pour toucher du doigt les graphes, les groupes, les topologies, les tribus et les espaces vectoriels.`),
      commencer,
    ),
    el('footer', { class: 'credit' }, 'Bienvenu ESSEGNON · Université d’Abomey-Calavi'),
  );
}

/* Archipel : les cinq îles */
function ecranArchipel() {
  const retour = el('button', { class: 'icone-bouton', type: 'button', 'aria-label': 'Retour à l’accueil' }, icone('retour'));
  retour.addEventListener('click', () => afficher(ecranTitre()));
  const total = ILES.reduce((s, i) => s + etoilesIle(i), 0);
  const cartes = ILES.map((ile, k) => {
    const e = etoilesIle(ile);
    const max = ile.niveaux.length * 3;
    const faits = ile.niveaux.filter((n) => progression()[n.id]).length;
    const b = el('button', { class: `ile-carte ile-${ile.id}`, type: 'button', 'aria-label': `${ile.nom}, ${faits} niveaux réussis sur ${ile.niveaux.length}` },
      el('span', { class: 'embleme' }, icone(`ile-${ile.id}`, 30)),
      el('span', { class: 'ile-texte' },
        el('small', { class: 'surtitre' }, `Île ${k + 1}`),
        el('strong', {}, ile.nom),
        el('small', { class: 'notions' }, ile.notions),
        el('span', { class: 'jauge', style: `--avance: ${(faits / ile.niveaux.length) * 100}%` })),
      el('span', { class: 'ile-etoiles' }, etoile(e > 0, 14), `${e}/${max}`));
    b.addEventListener('click', () => afficher(ecranCarte(ile)));
    return b;
  });
  return el('main', { class: 'ecran archipel' },
    el('header', { class: 'entete' },
      retour,
      el('div', { class: 'titres' }, el('span', { class: 'surtitre' }, 'Structures'), el('h1', {}, 'L’archipel')),
      el('span', { class: 'compteur-etoiles' }, etoile(true, 14), `${total}`),
    ),
    el('p', { class: 'enonce' }, 'Chaque île est une structure. Elles sont toutes ouvertes ; l’ordre proposé suit le fil du cours.'),
    el('div', { class: 'liste-iles' }, ...cartes),
  );
}

/* Carte des niveaux */
function ecranCarte(ile: Ile = GRAPHES) {
  const NIVEAUX = ile.niveaux;
  const prog = progression();
  const pas = 88;
  const hauteur = NIVEAUX.length * pas + 20;
  const xs = [96, 264];
  const pos = NIVEAUX.map((_, i) => [xs[i % 2] + (i % 4 === 1 ? -14 : i % 4 === 2 ? 14 : 0), 56 + i * pas] as const);
  const carte = svg('svg', { class: 'carte', viewBox: `0 0 360 ${hauteur}`, role: 'list' });
  let d = `M${pos[0][0]} ${pos[0][1]}`;
  for (let i = 1; i < pos.length; i++) {
    const [x0, y0] = pos[i - 1];
    const [x1, y1] = pos[i];
    d += ` C${x0} ${y0 + pas * 0.55}, ${x1} ${y1 - pas * 0.55}, ${x1} ${y1}`;
  }
  carte.append(svg('path', { class: 'sentier', d }));
  // portion parcourue
  const fait = NIVEAUX.findIndex((n) => !prog[n.id]);
  const dernier = fait === -1 ? NIVEAUX.length - 1 : fait;
  if (dernier > 0) {
    let d2 = `M${pos[0][0]} ${pos[0][1]}`;
    for (let i = 1; i <= dernier; i++) {
      const [x0, y0] = pos[i - 1];
      const [x1, y1] = pos[i];
      d2 += ` C${x0} ${y0 + pas * 0.55}, ${x1} ${y1 - pas * 0.55}, ${x1} ${y1}`;
    }
    carte.append(svg('path', { class: 'sentier parcouru', d: d2 }));
  }
  NIVEAUX.forEach((n, i) => {
    const [x, y] = pos[i];
    const ouvert = debloque(ile, i);
    const e = prog[n.id] ?? 0;
    const droite = i % 2 === 0;
    const g = svg('g', {
      class: `etape${ouvert ? '' : ' verrouille'}${e ? ' faite' : ''}${ouvert && !e ? ' actuelle' : ''}`,
      transform: `translate(${x} ${y})`,
      role: 'listitem',
      tabindex: ouvert ? 0 : -1,
      'aria-label': `Niveau ${i + 1}, ${n.titre}${ouvert ? '' : ', verrouillé'}`,
    });
    const droiteZone = i % 2 === 0;
    // zone tactile couvrant la pastille et le titre
    g.append(svg('rect', { class: 'zone-tactile', x: droiteZone ? -34 : -190, y: -34, width: 224, height: 78, rx: 14 }));
    g.append(svg('circle', { class: 'anneau', r: 30 }), svg('circle', { class: 'pastille-etape', r: 24 }));
    if (ouvert) {
      const t = svg('text', { class: 'numero', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = String(i + 1);
      g.append(t);
    } else {
      const ic = icone('cadenas', 18);
      ic.setAttribute('x', '-9');
      ic.setAttribute('y', '-9');
      g.append(ic);
    }
    const tx = droite ? 42 : -42;
    const titre = svg('text', { class: 'nom-etape', x: tx, y: -4, 'text-anchor': droite ? 'start' : 'end' });
    titre.textContent = n.titre;
    const notion = svg('text', { class: 'notion-etape', x: tx, y: 14, 'text-anchor': droite ? 'start' : 'end' });
    notion.textContent = n.notion;
    g.append(titre, notion);
    const et = svg('g', { transform: `translate(${-27} ${34})` });
    if (e) for (let k = 0; k < 3; k++) {
      const s = etoile(k < e, 14);
      s.setAttribute('x', String(k * 19));
      et.append(s);
    }
    g.append(et);
    if (ouvert) {
      const go = () => afficher(ecranNiveau(ile, i));
      g.addEventListener('click', go);
      g.addEventListener('keydown', (ev) => (ev as KeyboardEvent).key === 'Enter' && go());
    }
    carte.append(g);
  });

  const total = NIVEAUX.reduce((s, n) => s + (prog[n.id] ?? 0), 0);
  const retour = el('button', { class: 'icone-bouton', type: 'button', 'aria-label': 'Retour à l’archipel' }, icone('retour'));
  retour.addEventListener('click', () => afficher(ecranArchipel()));
  const bac = el('button', { class: 'carte-bac', type: 'button' },
    icone('bac', 22),
    el('span', {}, el('strong', {}, 'Bac à sable'), el('small', {}, 'Dessinez un graphe, lisez ses propriétés')),
    icone('suivant', 18));
  bac.addEventListener('click', () => afficher(ecranBac(() => afficher(ecranCarte()))));
  const k = ILES.indexOf(ile);
  const prochaine = ILES[(k + 1) % ILES.length];
  const suite = el('button', { class: 'carte-bac suite-ile', type: 'button' },
    icone(`ile-${prochaine.id}`, 22),
    el('span', {}, el('strong', {}, k + 1 < ILES.length ? `Île suivante : ${prochaine.nom.replace(/^Île (des )?/, '')}` : `Retour à l’${prochaine.nom}`), el('small', {}, prochaine.notions)),
    icone('suivant', 18));
  suite.addEventListener('click', () => afficher(ecranCarte(prochaine)));

  return el('main', { class: 'ecran carte-ecran' },
    el('header', { class: 'entete' },
      retour,
      el('div', { class: 'titres' }, el('span', { class: 'surtitre' }, 'Structures'), el('h1', {}, ile.nom)),
      el('span', { class: 'compteur-etoiles' }, etoile(true, 14), `${total}/${NIVEAUX.length * 3}`),
    ),
    carte,
    ile === GRAPHES ? bac : null,
    suite,
  );
}

/* Niveau */
function ecranNiveau(ile: Ile, index: number): HTMLElement {
  const NIVEAUX = ile.niveaux;
  const n: FicheNiveau = NIVEAUX[index];
  const statut = el('p', { class: 'statut', 'aria-live': 'polite' });
  const compteur = el('span', { class: 'compteur' });
  const legende = el('p', { class: 'legende', 'aria-live': 'polite' });
  const controles = el('div', { class: 'controles' });
  const zone = el('div', { class: 'zone-plateau' });

  const majCompteur = (c: number) => {
    compteur.textContent = `${c} ${c > 1 ? n.libelleCoups : n.libelleCoups.replace(/s(?=\s|$)/g, '')}`;
  };
  const hote: Hote = {
    controles,
    statut(t, ton = 'neutre') {
      statut.textContent = t;
      statut.dataset.ton = ton;
    },
    coups: majCompteur,
    legende(t) {
      legende.textContent = t ?? '';
      legende.classList.toggle('visible', !!t);
    },
    async reussite(c) {
      const e = etoilesPour(n, c);
      noterEtoiles(n.id, e);
      await partie.apresReussite();
      ecran.append(fiche(e));
    },
  };
  const partie = creerPartie(ile.id, n, hote);
  majCompteur(0);
  zone.append(partie.scene.racine);

  const retour = el('button', { class: 'icone-bouton', type: 'button', 'aria-label': 'Retour à la carte' }, icone('retour'));
  retour.addEventListener('click', () => afficher(ecranCarte(ile)));
  const recommencer = el('button', { class: 'icone-bouton', type: 'button', 'aria-label': 'Recommencer' }, icone('recommencer'));
  recommencer.addEventListener('click', () => !partie.fini && partie.recommencer());

  function fiche(e: number) {
    const suivant = index + 1 < NIVEAUX.length;
    const boutonSuivant = el('button', { class: 'bouton principal', type: 'button' }, suivant ? 'Niveau suivant' : 'Retour à l’île');
    boutonSuivant.addEventListener('click', () => afficher(suivant ? ecranNiveau(ile, index + 1) : ecranCarte(ile)));
    const rejouer = el('button', { class: 'bouton secondaire', type: 'button' }, 'Rejouer');
    rejouer.addEventListener('click', () => afficher(ecranNiveau(ile, index)));
    const voile = el('div', { class: 'voile' });
    return el('div', { class: 'resultat', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'res-titre' },
      voile,
      el('section', { class: 'feuille' },
        el('div', { class: 'poignee' }),
        el('div', { class: 'etoiles-grandes' }, ...[0, 1, 2].map((k) => {
          const s = etoile(k < e, 34);
          s.style.animationDelay = `${180 + k * 140}ms`;
          return s;
        })),
        el('p', { class: 'surtitre' }, `Niveau ${index + 1} réussi`),
        el('h2', { id: 'res-titre' }, n.notion),
        ...n.explication.map((t) => el('p', { class: 'explication' }, t)),
        el('div', { class: 'actions' }, rejouer, boutonSuivant),
      ),
    );
  }

  const ecran = el('main', { class: `ecran niveau ile-${ile.id} niveau-${n.id}` },
    el('header', { class: 'entete' },
      retour,
      el('div', { class: 'titres' }, el('span', { class: 'surtitre' }, `Niveau ${index + 1} sur ${NIVEAUX.length}`), el('h1', {}, n.titre)),
      recommencer,
    ),
    el('p', { class: 'enonce' }, n.enonce),
    zone,
    legende,
    el('div', { class: 'barre-statut' }, statut, compteur),
    controles,
  );
  return ecran;
}

// Navigation directe, utile pour les tests : #archipel, #carte, #ile-tribus, #bac, #niveau-3, #algebre-2
function demarrer() {
  const h = location.hash.slice(1);
  if (h === 'archipel') return afficher(ecranArchipel());
  if (h === 'carte') return afficher(ecranCarte());
  if (h === 'bac') return afficher(ecranBac(() => afficher(ecranCarte())));
  const i = /^ile-(\w+)$/.exec(h);
  if (i && trouverIle(i[1])) return afficher(ecranCarte(trouverIle(i[1])));
  const m = /^(niveau|\w+)-(\d+)$/.exec(h);
  const ile = m && (m[1] === 'niveau' ? GRAPHES : trouverIle(m[1]));
  if (m && ile && ile.niveaux[+m[2] - 1] && debloque(ile, +m[2] - 1)) return afficher(ecranNiveau(ile, +m[2] - 1));
  afficher(ecranTitre());
}
demarrer();
addEventListener('hashchange', demarrer);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
