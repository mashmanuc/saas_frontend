/**
 * Поворот планшета → вписати сторінку заново (власник 2026-10-20, прохід «очима вчителя»: «6 роби»).
 *
 * Автопідгін кімнати вміє лише ЗМЕНШУВАТИ масштаб, тож після повороту з вертикалі в горизонталь аркуш лишався
 * дрібним, як у вертикалі. Тепер поворот (орієнтація вікна змінилась з минулого виміру) вписує сторінку заново —
 * але лише після першого вписування і якщо вчитель масштаб руками не чіпав (ручний масштаб недоторканний).
 */
export interface RotateFitInput {
  /** Орієнтація вікна на минулому вимірі; `null` — вимірів ще не було. */
  prevLandscape: boolean | null
  landscape: boolean
  initialFitDone: boolean
  userZoomed: boolean
}

export function shouldRefitAfterRotate(input: RotateFitInput): boolean {
  const flipped = input.prevLandscape !== null && input.prevLandscape !== input.landscape
  return flipped && input.initialFitDone && !input.userZoomed
}
