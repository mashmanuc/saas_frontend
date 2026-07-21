/**
 * mathquillLoader — лінива runtime-загрузка MathQuill+jQuery у SPA.
 *
 * РІШЕННЯ (MathQuill-блок, ТЗ §0.1): НЕ бандлимо — вантажимо ті САМІ
 * vendor-файли, що вже служать standalone-воронці (`/mash/grapher/vendor/`,
 * задеплоєні на проді, шрифти включно). Плюси: 0 КБ у бандлі SPA, одна
 * копія бібліотеки на весь продукт, однакова поведінка з /mash/grapher/.
 * MathQuill 0.10 — глобальна бібліотека, вимагає window.jQuery ДО себе.
 *
 * Фейл завантаження → null + ОДИН console.warn (НЕ silent, LAW §12);
 * caller-и показують звичайний <input> (деградація без втрати функції).
 */

export interface MQFieldApi {
  latex(): string
  latex(v: string): void
  focus(): void
  revert(): void
}

export interface MQInterface {
  MathField(el: HTMLElement, opts: Record<string, unknown>): MQFieldApi
}

declare global {
  interface Window {
    jQuery?: unknown
    MathQuill?: { getInterface(v: number): MQInterface }
  }
}

const VENDOR = '/mash/grapher/vendor'

let loadPromise: Promise<MQInterface | null> | null = null
let warned = false

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('failed to load ' + src))
    document.head.appendChild(s)
  })
}

function injectCss(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

/** Лінива ініціалізація; кешується. null = недоступний (fallback на input). */
export function loadMathQuill(): Promise<MQInterface | null> {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      // Уже є (напр. тест підклав fake, або інший код завантажив) — беремо.
      if (!window.MathQuill) {
        // У тестовому середовищі скрипт-інжекція недоступна — детерміновано
        // йдемо у fallback-гілку (компонентні тести перевіряють саме її;
        // MQ-wiring тестується окремо через підкладений window.MathQuill).
        if (import.meta.env.MODE === 'test') return null
        injectCss(`${VENDOR}/mathquill/mathquill.css`)
        if (!window.jQuery) await injectScript(`${VENDOR}/jquery/jquery.min.js`)
        await injectScript(`${VENDOR}/mathquill/mathquill.min.js`)
      }
      const mq = window.MathQuill?.getInterface(2) ?? null
      if (!mq && !warned) {
        warned = true
        console.warn('[mathquillLoader] MathQuill unavailable after load — falling back to plain input')
      }
      return mq
    } catch (err) {
      if (!warned) {
        warned = true
        console.warn('[mathquillLoader] load failed — falling back to plain input:', err)
      }
      return null
    }
  })()
  return loadPromise
}

/** Тільки для тестів: скинути кеш (щоб підкладати різні window.MathQuill). */
export function __resetMathQuillLoaderForTests(): void {
  loadPromise = null
  warned = false
}
