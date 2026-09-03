/** Persist challenge progress across refresh (reset on new kingdom). */

const KEY = 'fairyTaleKingdom.challenges';

export interface ChallengePrefs {
  claimedIds: string[];
  activeId: string | null;
  nextOfferAt: number;
  /** Opening / first-offer card already shown this kingdom. */
  offerSeen: boolean;
}

const DEFAULT: ChallengePrefs = {
  claimedIds: [],
  activeId: null,
  nextOfferAt: 0,
  offerSeen: false,
};

export function loadChallengePrefs(): ChallengePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, claimedIds: [] };
    const parsed = JSON.parse(raw) as Partial<ChallengePrefs>;
    return {
      claimedIds: Array.isArray(parsed.claimedIds)
        ? parsed.claimedIds.filter((x): x is string => typeof x === 'string')
        : [],
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      nextOfferAt:
        typeof parsed.nextOfferAt === 'number' ? parsed.nextOfferAt : 0,
      offerSeen: Boolean(parsed.offerSeen),
    };
  } catch {
    return { ...DEFAULT, claimedIds: [] };
  }
}

export function saveChallengePrefs(prefs: ChallengePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function resetChallengePrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
