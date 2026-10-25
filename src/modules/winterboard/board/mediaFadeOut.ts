/**
 * Звук, що стихає, а не обривається (LAW §9 v1.61, власник 2026-10-25: «коли увімкнений звук або відео і я переключаю
 * сторінки, швидко обривається цей звук… треба м'які переходи, потухання звуку» → «роби»).
 *
 * Мелодія чи відео з файлу, що грає, зникає з дошки (інша сторінка, вихід із дошки, видалили) — програвач Vue знімає разом
 * із сторінкою, і браузер ставить вилучений <audio>/<video> на паузу. Тут той самий елемент ще в момент зняття
 * переноситься в невидиме місце на сторінці: за стандартом HTML пауза настає, лише якщо після вилучення елемент так і не
 * повернувся в документ до найближчого стабільного стану, — а він повернувся, тож звук не переривається. Далі гучність
 * плавно сходить до нуля за `MEDIA_FADE_OUT_MS`, потім пауза й елемент прибирається. Зображення відео не видно.
 *
 * Лише вигляд і звук цього екрана: без ops, Replay і мережі. YouTube так не вміє (чужий програвач у рамці).
 */
export const MEDIA_FADE_OUT_MS = 2000
const STEP_MS = 50
const HOST_ID = 'wb-media-fade-host'

function host(): HTMLElement {
  let el = document.getElementById(HOST_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = HOST_ID
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;'
    document.body.appendChild(el)
  }
  return el
}

/** Грає — дотягти звук плавним стиханням; не грає — нічого (Vue прибере елемент, як і раніше). */
export function fadeOutDetached(el: HTMLMediaElement | null | undefined, ms = MEDIA_FADE_OUT_MS): boolean {
  if (typeof document === 'undefined' || !el || el.paused || el.ended || el.muted || !(el.volume > 0)) return false
  host().appendChild(el)
  const from = el.volume
  const startedAt = Date.now()
  const finish = () => {
    el.pause()
    el.remove()
  }
  const step = () => {
    if (el.paused) return finish()
    const k = Math.min(1, (Date.now() - startedAt) / ms)
    el.volume = Math.max(0, from * (1 - k))
    if (k >= 1) return finish()
    setTimeout(step, STEP_MS)
  }
  setTimeout(step, STEP_MS)
  return true
}
