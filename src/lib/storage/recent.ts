// Most-recent-first list of session hashes: `hash` moves to the front, capped at `max`.
export function pushRecent(list: string[] | undefined, hash: string, max = 5): string[] {
  return [hash, ...(list ?? []).filter((h) => h !== hash)].slice(0, max);
}
