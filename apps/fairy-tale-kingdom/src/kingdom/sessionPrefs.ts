/** Session-scoped prefs for first-run UX (not full layout). */

const OPENING_GUIDE_KEY = 'fairyTaleKingdom.openingGuideSeen';

export function loadOpeningGuideSeen(): boolean {
  try {
    return localStorage.getItem(OPENING_GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveOpeningGuideSeen(seen = true): void {
  try {
    localStorage.setItem(OPENING_GUIDE_KEY, seen ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Call when starting a brand-new kingdom so the welcome card shows again. */
export function resetOpeningGuideSeen(): void {
  try {
    localStorage.removeItem(OPENING_GUIDE_KEY);
  } catch {
    /* ignore */
  }
}
