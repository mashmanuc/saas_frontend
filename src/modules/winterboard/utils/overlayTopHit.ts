/**
 * overlayTopHit — WYSIWYG-виділення при перекритті HTML-overlay карток.
 *
 * Проблема: тіло ВИДІЛЕНОЇ картки (geomash/graphmash3d) має pointer-events:auto
 * на всій площі й перехоплює кліки навіть там, де ВІЗУАЛЬНО зверху лежить інша
 * картка (невиділені обгортки — pointer-events:none, тому і DOM-hit-test, і
 * elementsFromPoint їх не бачать). Юзер клацає по верхньому об'єкту, а взаємодіє
 * з нижнім активним.
 *
 * Рішення: геометрична перевірка — серед усіх asset-обгорток (div[class*="-overlay"]
 * з data-*-id) знайти ті, чий rect містить точку кліку і які намальовані ВИЩЕ
 * нашої (z-index, при рівності — DOM-порядок). Якщо така є — повернути її asset-id,
 * щоб хост перемкнув виділення (той самий selectItems-шлях, без нових write-шляхів).
 */

function zIndexOf(el: HTMLElement): number {
  const z = Number(getComputedStyle(el).zIndex)
  return Number.isFinite(z) ? z : 0
}

/** true якщо `a` малюється над `b` (сиблінги одного stacking-контексту). */
function isPaintedAbove(a: HTMLElement, b: HTMLElement): boolean {
  const za = zIndexOf(a)
  const zb = zIndexOf(b)
  if (za !== zb) return za > zb
  // рівний z-index → пізніший у DOM малюється зверху
  return !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/** asset-id з першого data-*-id атрибута обгортки (data-geomash-id / data-solid-id / …). */
function assetIdOf(wrap: HTMLElement): string | null {
  for (const attr of Array.from(wrap.attributes)) {
    if (attr.name.startsWith('data-') && attr.name.endsWith('-id') && attr.value) return attr.value
  }
  return null
}

/**
 * Якщо в точці (clientX, clientY) над НАШОЮ обгорткою намальована чужа asset-картка —
 * повертає її asset-id (найвищої з таких); інакше null (ми top-most, обробляємо самі).
 */
export function topmostForeignOverlayAssetId(
  clientX: number,
  clientY: number,
  ownRootEl: HTMLElement | null,
): string | null {
  if (typeof document === 'undefined' || !ownRootEl) return null
  const ownWrap = ownRootEl.closest('div[class*="-overlay"]') as HTMLElement | null
  if (!ownWrap) return null

  let best: HTMLElement | null = null
  const candidates = document.querySelectorAll<HTMLElement>('div[class*="-overlay"]')
  for (const wrap of candidates) {
    if (wrap === ownWrap || wrap.contains(ownWrap) || ownWrap.contains(wrap)) continue
    const id = assetIdOf(wrap)
    if (!id) continue // службові обгортки (text-edit/group-drag) — не asset
    const r = wrap.getBoundingClientRect()
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue
    if (!isPaintedAbove(wrap, ownWrap)) continue
    if (!best || isPaintedAbove(wrap, best)) best = wrap
  }
  return best ? assetIdOf(best) : null
}

// ── Б-147: коліщатко над карткою з прокруткою ────────────────────────────────
// Власник 2026-10-06: «при роботі це реальна проблема». Коліщатко над карткою спершу гортає
// її текст, а коли текст дійшов до кінця — далі аркуш. Тіло картки з олівцем прозоре для
// подій (чорнило лягає поверх), тож картку під курсором шукаємо так само геометрично.

function inside(el: Element, clientX: number, clientY: number): boolean {
  const r = el.getBoundingClientRect()
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
}

/** Чи може елемент прокрутитися в бік коліщатка (лише власна прокрутка: overflow auto/scroll). */
export function canScrollToward(el: Element, dx: number, dy: number): boolean {
  if (dy !== 0 && el.scrollHeight > el.clientHeight + 1) {
    const oy = getComputedStyle(el).overflowY
    const room = dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
    if ((oy === 'auto' || oy === 'scroll') && room) return true
  }
  if (dx !== 0 && el.scrollWidth > el.clientWidth + 1) {
    const ox = getComputedStyle(el).overflowX
    const room = dx > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0
    if ((ox === 'auto' || ox === 'scroll') && room) return true
  }
  return false
}

/** Подія коліщатка прийшла з елемента (до `stop`, не включно), що сам може прокрутитися. */
export function hasOwnScrollToward(target: EventTarget | null, stop: Element, dx: number, dy: number): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== stop; el = el.parentElement) {
    if (canScrollToward(el, dx, dy)) return true
  }
  return false
}

/**
 * Найглибший елемент картки, намальованої найвище в точці, що може прокрутитися в бік
 * коліщатка; інакше null. Лише верхня картка: що під нею — користувач не бачить.
 */
export function cardScrollerAt(root: ParentNode, clientX: number, clientY: number, dx: number, dy: number): HTMLElement | null {
  let top: HTMLElement | null = null
  for (const wrap of root.querySelectorAll<HTMLElement>('div[class*="-overlay"]')) {
    if (!assetIdOf(wrap) || !inside(wrap, clientX, clientY)) continue
    if (!top || isPaintedAbove(wrap, top)) top = wrap
  }
  if (!top) return null
  let found: HTMLElement | null = null
  for (const el of top.querySelectorAll<HTMLElement>('*')) {
    // документний порядок: з вкладених — пізніший глибший
    if (canScrollToward(el, dx, dy) && inside(el, clientX, clientY)) found = el
  }
  return found
}
