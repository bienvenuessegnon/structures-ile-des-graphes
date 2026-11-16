import { PARTIES_ALGEBRE } from './algebre/parties';
import type { FicheNiveau, Hote, Partie, ConstructeurPartie } from './partie';
import { PARTIES_GRAPHES } from './parties';
import { PARTIES_TOPOLOGIE } from './topologie/parties';
import { PARTIES_TRIBUS } from './tribus/parties';
import { PARTIES_VECTORIEL } from './vectoriel/parties';

const PARTIES: Record<string, Record<string, ConstructeurPartie>> = {
  graphes: PARTIES_GRAPHES,
  algebre: PARTIES_ALGEBRE,
  topologie: PARTIES_TOPOLOGIE,
  tribus: PARTIES_TRIBUS,
  vectoriel: PARTIES_VECTORIEL,
};

export function creerPartie(ile: string, n: FicheNiveau, hote: Hote): Partie<any, any> {
  const C = PARTIES[ile][n.type];
  const p = new C(n, hote);
  p.monter();
  p.brancher();
  return p;
}
