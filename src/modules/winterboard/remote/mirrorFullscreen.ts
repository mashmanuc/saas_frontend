/**
 * «Дзеркало дошки» на весь екран браузера (ТЗ «швидше, без учителя, зручні кути» 2026-10-09 §3):
 * на телефоні під кадр камери лишалось менше чверті екрана — Android Chrome у повноекранному режимі
 * ховає смугу адреси. Протокол пульта не чіпає.
 *
 *  - `enter` — ЛИШЕ з обробника дії вчителя (відкриття Дзеркала з пульта): браузер дає повний екран
 *    тільки на жест. Не вміє (iPhone: на телефоні — лише для відео) чи відмовив — Дзеркало працює як є.
 *  - `leave` — при закритті Дзеркала, і лише якщо входили ми: повний екран, у який перейшли інакше,
 *    не наш. Учитель уже вийшов сам (жест «назад») — нічого не робимо.
 *  - Закрили раніше, ніж браузер підтвердив вхід, — виходимо, щойно підтвердив.
 */

/** Мінімум від `document`, щоб тести не залежали від справжнього повноекранного режиму */
export interface FullscreenDoc {
  readonly fullscreenElement: Element | null
  exitFullscreen?: () => Promise<void>
  readonly documentElement: { requestFullscreen?: (opts?: FullscreenOptions) => Promise<void> | void }
}

export type FullscreenStep = 'enter' | 'exit'

const errName = (e: unknown) => (e as { name?: string } | null)?.name ?? 'unknown'

export function createMirrorFullscreen(doc: FullscreenDoc, onError?: (step: FullscreenStep, name: string) => void) {
  /** Дзеркало відкрите й хоче повний екран (закрили — false) */
  let wanted = false
  /** Повний екран увімкнули ми (браузер підтвердив) */
  let entered = false

  function exit(): void {
    entered = false
    if (!doc.fullscreenElement || typeof doc.exitFullscreen !== 'function') return   // учитель вийшов сам
    doc.exitFullscreen().catch((e: unknown) => {
      // Вийшли між перевіркою й викликом (жест «назад») — повного екрана вже немає, робити нічого
      onError?.('exit', errName(e))
    })
  }

  return {
    /** Викликати синхронно з обробника натискання — інакше браузер відмовить */
    enter(): void {
      wanted = true
      const el = doc.documentElement
      if (doc.fullscreenElement || typeof el.requestFullscreen !== 'function') return   // уже на весь екран / не вміє
      let p: Promise<void> | void
      try {
        p = el.requestFullscreen({ navigationUI: 'hide' })
      } catch (e) {
        // Старі браузери кидають одразу (заборонено політикою сторінки) — Дзеркало працює й без повного екрана
        onError?.('enter', errName(e))
        return
      }
      Promise.resolve(p).then(() => {
        entered = true
        if (!wanted) exit()   // Дзеркало закрили, поки браузер вмикав повний екран
      }, (e: unknown) => {
        // Відмовлено (налаштування браузера, не жест) — Дзеркало працює й так, лишається смуга адреси
        onError?.('enter', errName(e))
      })
    },
    /** Дзеркало закрили */
    leave(): void {
      wanted = false
      if (entered) exit()
    },
    get entered() { return entered },
  }
}

export type MirrorFullscreen = ReturnType<typeof createMirrorFullscreen>
