const SHOW_CAREER_TODOS_KEY = 'ftk-show-career-todos';

export function loadShowCareerTodos(): boolean {
  try {
    const v = localStorage.getItem(SHOW_CAREER_TODOS_KEY);
    // Default hidden — reopen from the HUD "Wishes" button when needed
    if (v === null) return false;
    return v === '1';
  } catch {
    return false;
  }
}

export function saveShowCareerTodos(on: boolean): void {
  try {
    localStorage.setItem(SHOW_CAREER_TODOS_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
