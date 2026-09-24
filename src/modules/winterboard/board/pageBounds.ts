/**
 * Лівий і верхній край аркуша — межа для кожного об'єкта.
 *
 * Рішення власника 2026-09-24: «щоб всі об'єкти і при створенні, і при
 * переміщенні не вилазили за лівий і верхній край». Привід: картка, що
 * заїхала за верх, ховає свій заголовок — єдину ручку перетягування, і
 * вчитель уже не може її зсунути.
 *
 * Лише ДІЇ КОРИСТУВАЧА (створення, перетягування, груповий рух, зміна
 * розміру). Replay, чужі операції й undo (`skipHistory`) застосовуються як є —
 * інакше локальна дошка розійшлася б із сервером. Правий і нижній край
 * лишаються як були (у WBCanvas.clampAssetToPage — досяжний хедер).
 */

/** x ≥ 0, y ≥ 0; повертає той самий об'єкт, якщо він уже в межах. */
export function clampToPageTopLeft<T extends { x: number; y: number }>(o: T): T {
  const x = Number.isFinite(o.x) && o.x < 0 ? 0 : o.x
  const y = Number.isFinite(o.y) && o.y < 0 ? 0 : o.y
  return x === o.x && y === o.y ? o : { ...o, x, y }
}

/**
 * Зсув групи вздовж однієї осі, обмежений краєм: `min` — найменша координата
 * групи. Уже за краєм (min < 0, старі дані) — далі не пускаємо, назад можна.
 */
export function limitDeltaAtEdge(min: number, d: number): number {
  if (!Number.isFinite(min)) return d
  return min >= 0 ? Math.max(d, -min) : Math.max(d, 0)
}

/** Найменші x/y серед об'єктів, що рухаються (картки — кут, штрихи — точки). */
export function movingMin(
  strokes: ReadonlyArray<{ points: ReadonlyArray<{ x: number; y: number }> }>,
  assets: ReadonlyArray<{ x: number; y: number }>,
): { minX: number; minY: number } {
  let minX = Infinity
  let minY = Infinity
  for (const a of assets) {
    if (a.x < minX) minX = a.x
    if (a.y < minY) minY = a.y
  }
  for (const s of strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
    }
  }
  return { minX, minY }
}
