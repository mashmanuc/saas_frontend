/**
 * «Пише рукою» (LAW §9 v1.66, власник 2026-10-26: «треба було б, щоб малювалися символи. Писалися. А тоді вони
 * перетворювалися на об'єкт»).
 *
 * «Речення» лягає на дошку одним `asset_add`, як і було (збереження, пульт, Replay — без змін). Ноутбук, що його
 * написав, показує штрихи в темпі руки: у layout кожен штрих має `t` — мить, коли рука його закінчує (той самий час,
 * яким ✍ Інтегралика малює чорнилом). Лише вигляд цього екрана: інші клієнти й перезавантаження бачать готове.
 */
import type { DictationLineData } from './dictationLine'

const starts = new Map<string, number>()
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Щойно продиктоване — показати, як пишеться (до додавання об'єкта, щоб малюнок застав початок). */
export function revealDictation(id: string): void {
  starts.set(id, now())
  setTimeout(() => starts.delete(id), 120_000)
}

/** Скільки мс руки вже минуло, або null — показувати готове. */
export function revealElapsed(id: string): number | null {
  const start = starts.get(id)
  return start === undefined ? null : now() - start
}

export function finishReveal(id: string): void {
  starts.delete(id)
}

/** Скільки пише рука все речення. */
export function revealDuration(data: DictationLineData): number {
  return data.layout.strokes.reduce((m, s) => Math.max(m, s.t), 0)
}
