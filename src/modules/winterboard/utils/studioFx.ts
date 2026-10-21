/**
 * Частинки Студії уроків (макет дизайнера, 2026-10-22): сезонні знаки від логотипа на обкладинці,
 * математичні знаки від «Нова дошка», цифри π від пасхалки в пошуку.
 * Лише миша і лише без «зменшити рух»: на сенсорних панелях шкіл і з reduced-motion — нічого.
 * Елементи вішаються на body, тож стилі — інлайном (scoped CSS компонента їх не бачить).
 */

export const SEASON_FX: Readonly<Record<string, readonly string[]>> = {
  winter: ['❄', '❅', '❆', '·'],
  spring: ['✿', '❀', '·', '✿'],
  summer: ['✦', '✧', '☼', '·'],
  autumn: ['❦', '❧', '·', '❦'],
}

export const NEW_BOARD_FX = ['½', 'x²', '∫', '△', 'π', '√', '∑', '%'] as const

export function fxAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !window.matchMedia('(pointer: coarse)').matches
}

/** Розкидає знаки з точки (x, y) у вікні; кожен сам прибирається після анімації. */
export function burstAt(x: number, y: number, chars: readonly string[], spread = 60): void {
  if (!fxAllowed()) return
  for (const ch of chars) {
    const el = document.createElement('span')
    el.textContent = ch
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:60;pointer-events:none;`
      + `font-weight:700;color:var(--wb-brand,#047857);font-size:${12 + Math.random() * 10}px`
    if (typeof el.animate !== 'function') continue
    document.body.appendChild(el)
    const a = Math.random() * Math.PI * 2
    const d = spread * (0.5 + Math.random())
    const fall = 40 + Math.random() * 60
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d * 0.6 + fall}px)) `
            + `scale(1) rotate(${(Math.random() - 0.5) * 180}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => el.remove()
  }
}

export function burstFrom(el: Element, chars: readonly string[], spread?: number): void {
  const r = el.getBoundingClientRect()
  burstAt(r.left + r.width / 2, r.top + r.height / 2, chars, spread)
}
