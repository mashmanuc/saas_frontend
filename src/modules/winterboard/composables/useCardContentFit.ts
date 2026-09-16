/**
 * TLV2-05C · спільна авто-висота карток із `contentFit: 'height'` (SSOT INV-25).
 *
 * Один шлях для всіх таких карток:
 *   картка міряє вміст → `request-height(px)` → host `nextAutoFitHeight` → `asset_update`.
 * Власних `tryFit` у рендерерах немає: картка лише вимірює й повідомляє потребу,
 * рішення (одиниці дошки, межа сторінки, ручна/автоматична висота, epsilon) — у host.
 *
 * Коли міряти:
 *   • після монтування — після Vue render, KaTeX і `document.fonts.ready`;
 *   • після зміни вмісту чи масштабу (джерела передає картка);
 *   • коли картка знову стала вимірюваною: повернулась із трею, вийшла з fullscreen,
 *     учитель повернувся до інструмента «виділення».
 * Коли НЕ міряти: розгорнута, згорнута, неінтерактивна (перо, replay, учень) —
 * такі стани не мають породжувати операцій.
 */
import { nextTick, onMounted, watch, type Ref, type WatchSource } from 'vue'

export interface CardContentFitOptions {
  root: Ref<HTMLElement | null>
  /** Тіло картки зі скролом (його `clientHeight` — видима частина). */
  body: Ref<HTMLElement | null>
  /** Вузол природного потоку вмісту: його висота не залежить від висоти картки. */
  flow: Ref<HTMLElement | null>
  /** Чи можна зараз міряти й писати. */
  canMeasure: () => boolean
  /** Що змінює висоту вмісту (дані, масштаб, ширина). */
  sources: WatchSource[]
  emitHeight: (neededPx: number) => void
}

/**
 * Скільки пікселів екрана потрібно картці: шапка й рамка + паддинги тіла + потік.
 *
 * Міряється ОКРЕМИЙ вузол потоку, не `body.scrollHeight`: той не буває меншим за
 * `clientHeight`, тож висока картка з дрібним текстом ніколи б не стиснулась.
 */
export function measureCardNeededPx(root: HTMLElement, body: HTMLElement, flow: HTMLElement): number {
  const outside = root.offsetHeight - body.clientHeight
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(body) : null
  const padY = style
    ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
    : 0
  return Math.ceil(outside + padY + flow.getBoundingClientRect().height)
}

export function useCardContentFit(options: CardContentFitOptions): { requestFit: () => void } {
  function requestFit(): void {
    if (!options.canMeasure()) return
    const root = options.root.value
    const body = options.body.value
    const flow = options.flow.value
    if (!root || !body || !flow) return
    const px = measureCardNeededPx(root, body, flow)
    if (px > 0) options.emitHeight(px)
  }

  const later = () => { void nextTick(requestFit) }

  onMounted(() => {
    later()
    // Web-шрифти (KaTeX теж) змінюють висоту рядків уже після першого виміру.
    const fonts = typeof document !== 'undefined'
      ? (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
      : undefined
    void fonts?.ready?.then(later)
  })

  watch(options.sources, later)
  watch(options.canMeasure, (can) => { if (can) later() })

  return { requestFit }
}
