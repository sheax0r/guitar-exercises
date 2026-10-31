// Licks saved from Ideate for Learn's Lick Drill, newest first, in localStorage.
export interface SavedLick { id: string; name: string; notes: number[]; createdAt: number }

const KEY = 'guitar-exercises.licks.v1';

export function loadLicks(): SavedLick[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((l): l is SavedLick => typeof l?.id === 'string' && typeof l.name === 'string'
        && Array.isArray(l.notes) && l.notes.length > 0 && l.notes.every((n: unknown) => Number.isInteger(n)))
      : [];
  } catch {
    return [];
  }
}

function store(licks: SavedLick[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(licks)); } catch { /* unavailable or full */ }
}

export function saveLick(name: string, notes: number[]): SavedLick {
  const lick = { id: crypto.randomUUID(), name: name.trim() || 'Untitled lick', notes, createdAt: Date.now() };
  store([lick, ...loadLicks()]);
  return lick;
}

export function deleteLick(id: string): SavedLick[] {
  const rest = loadLicks().filter(l => l.id !== id);
  store(rest);
  return rest;
}
