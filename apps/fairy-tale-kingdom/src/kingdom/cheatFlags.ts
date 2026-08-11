const STORAGE_KEY = 'ftk-cheat-infinite-gold';

export function loadInfiniteGoldCheat(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveInfiniteGoldCheat(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
