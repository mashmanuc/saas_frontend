/**
 * Які мініатюри сторінок перемалювати: лише ті, чий підпис вмісту змінився (або нові).
 * Власник 2026-10-21, мультиборд: після кожного штриха перемальовувались мініатюри всіх сторінок.
 */
export function changedPageIds(prev: ReadonlyMap<string, string>, next: ReadonlyMap<string, string>): string[] {
  const out: string[] = []
  for (const [id, sig] of next) if (prev.get(id) !== sig) out.push(id)
  return out
}
