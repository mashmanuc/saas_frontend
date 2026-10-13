/**
 * Б-195 «обʼєкт прилипає до курсора/пера» (власник на уроці 13.10, миша, відпускання над документом).
 *
 * Konva закінчує перетягування ЛИШЕ подією «кнопку відпущено» (`mouseup`/`touchend` у window —
 * `konva/lib/DragAndDrop.js`). Загубилась вона хоч раз (втрата фокуса, відпускання поза вікном,
 * збій браузера, перо з погашеними сумісними подіями) — перетягування не закінчується, і обʼєкт
 * їде за курсором БЕЗ натиснутої кнопки, доки не клацнеш туди, де `mouseup` дійде (вільне місце).
 * Відтворено на стенді 13.10: після «загубленого» відпускання рух без кнопки тягнув картку далі.
 *
 * Запобіжник (той самий принцип, що «олівець не прилипає» для малювання у WBCanvas):
 *  - рух миші/пера, коли ЖОДНА кнопка не натиснута (`buttons === 0`), а Konva ще тягне, —
 *    обʼєкт ставиться там, де він є;
 *  - вікно втратило фокус або сторінку сховано — так само.
 * Ставлення — штатне `node.stopDrag()`: далі звичайний `dragend` → clamp → asset-update (LAW §2,
 * запис змін тим самим шляхом). Звичайне перетягування не зачіпає: під час нього кнопка натиснута.
 */
import Konva from 'konva'

interface DragNode {
  isDragging(): boolean
  stopDrag(evt?: Event): void
}

interface StageLike {
  find(selector: (node: DragNode) => boolean): DragNode[]
}

export interface KonvaLike {
  DD: { isDragging: boolean }
  stages: StageLike[]
}

/** Поставити всі обʼєкти, які Konva ще тягне. → скільки поставлено. */
export function stopStaleDrags(konva: KonvaLike, evt?: Event): number {
  if (!konva.DD.isDragging) return 0
  let stopped = 0
  for (const stage of konva.stages) {
    for (const node of stage.find((n) => typeof n.isDragging === 'function' && n.isDragging())) {
      node.stopDrag(evt)
      stopped += 1
    }
  }
  return stopped
}

/** Підключити запобіжник; → функція відключення (для onBeforeUnmount). */
export function installKonvaStaleDragGuard(
  konva: KonvaLike = Konva as unknown as KonvaLike,
  win: Window = window,
  doc: Document = document,
): () => void {
  const onMove = (e: MouseEvent) => {
    if (e.buttons === 0) stopStaleDrags(konva, e)
  }
  const onBlur = () => { stopStaleDrags(konva) }
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') stopStaleDrags(konva)
  }
  // capture: спрацювати ДО власного window-mousemove Konva, щоб обʼєкт не зробив ані кроку без кнопки
  win.addEventListener('mousemove', onMove, true)
  win.addEventListener('pointermove', onMove, true)
  win.addEventListener('blur', onBlur)
  doc.addEventListener('visibilitychange', onVisibility)
  return () => {
    win.removeEventListener('mousemove', onMove, true)
    win.removeEventListener('pointermove', onMove, true)
    win.removeEventListener('blur', onBlur)
    doc.removeEventListener('visibilitychange', onVisibility)
  }
}
