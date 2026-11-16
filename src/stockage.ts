const PREFIXE = 'structures.v1.';

export function charger<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    return brut ? (JSON.parse(brut) as T) : structuredClone(defaut);
  } catch {
    return structuredClone(defaut);
  }
}

export function enregistrer(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : la partie continue sans sauvegarde */
  }
}

export type Progression = Record<string, number>;

export const progression = () => charger<Progression>('etoiles', {});

export function noterEtoiles(id: string, n: number) {
  const p = progression();
  if ((p[id] ?? 0) < n) {
    p[id] = n;
    enregistrer('etoiles', p);
  }
}
