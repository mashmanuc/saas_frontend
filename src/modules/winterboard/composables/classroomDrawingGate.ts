/**
 * Гейт малювання у класній кімнаті — ЧИСТИЙ предикат, винесений з
 * WBClassroomRoom.vue (isDrawingDisabled), щоб його можна було тестувати без
 * mount в'юхи (той самий підхід, що singleWriter.spec.ts).
 *
 * Чому існує (P0 classroom student ops, 2026-09-05, живий прогін у двох сесіях):
 * за INV-SINGLE-WRITER учень не пише в REST — його штрихи персистить writer
 * (учитель) echo-записом із WS `stroke.broadcast`. Якщо writer-а онлайн немає,
 * штрих учня летить у порожнечу: локально є, у БД — ні, після F5 зникає, а
 * індикатор каже «Незбережені зміни». Три перші умови — рівно ті, що були у
 * в'юсі; четверта нова: учень без онлайн-writer-а малювати не може.
 *
 * Порядок причин зафіксований: frozen → locked → no_permission → writer_offline.
 * OpsApplyService / REST-only write не зачіпаються — гейт лише ЗАБОРОНЯЄ вхід,
 * другого writer-а не створює.
 */

export interface DrawingGateInput {
  /** owner | host (INV-SINGLE-WRITER) */
  isWriter: boolean
  /** Запис фіналізовано (INV-23) — read-only всім */
  frozen: boolean
  /** Учитель замкнув дошку — не-writer-и не малюють */
  locked: boolean
  /** permissions.can_draw з bridge classroom/<lesson>/session/ */
  canDraw: boolean
  /**
   * Є кому echo-записати штрих учня: власний WS підключений І writer онлайн
   * (participants.is_online). Для writer-а значення не має.
   */
  writerOnline: boolean
}

export type DrawingBlockReason = 'frozen' | 'locked' | 'no_permission' | 'writer_offline' | null

export function drawingBlockReason(i: DrawingGateInput): DrawingBlockReason {
  if (i.frozen) return 'frozen'
  if (i.locked && !i.isWriter) return 'locked'
  if (!i.canDraw) return 'no_permission'
  if (!i.isWriter && !i.writerOnline) return 'writer_offline'
  return null
}

export function isStudentDrawingBlocked(i: DrawingGateInput): boolean {
  return drawingBlockReason(i) !== null
}
