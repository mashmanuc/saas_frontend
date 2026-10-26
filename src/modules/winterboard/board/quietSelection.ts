/**
 * «Тихе» виділення (LAW §9 v1.66, власник 2026-10-26: «якщо вводимо з мікрофона, тулбар не треба показувати, він
 * мішає… якщо вже потім ми натиснемо мишкою, щоб якісь дії виконати, то треба тоді, щоб появлявся тулбар»).
 *
 * Диктант з пульта виділяє нове «Речення» — інакше телефон не покаже його кнопок (знімок речення йде лише для
 * виділеного). Таке виділення — тихе: на проєкторі немає чорної панелі, рамки й кнопок вікна. Перший дотик мишею,
 * пером чи пальцем на цьому ноутбуці робить виділення звичайним — панель з'являється, як завжди. Лише вигляд цього
 * екрана: без ops, Replay і мережі.
 */
import { reactive } from 'vue'

export const quietSelection = reactive<{ id: string | null }>({ id: null })

let armed = false
function wake(): void {
  armed = false
  quietSelection.id = null
}

/** Об'єкт виділено з пульта — тихо, до першого дотику на цьому ноутбуці. */
export function selectQuietly(id: string): void {
  quietSelection.id = id
  if (armed || typeof window === 'undefined') return
  armed = true
  window.addEventListener('pointerdown', wake, { capture: true, once: true })
}

/** Виділення — саме той тихий об'єкт (панель, рамку й кнопки вікна не малюємо). */
export function isQuietSelection(selectedIds: readonly string[]): boolean {
  return quietSelection.id !== null && selectedIds.length === 1 && selectedIds[0] === quietSelection.id
}
