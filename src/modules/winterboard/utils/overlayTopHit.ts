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
