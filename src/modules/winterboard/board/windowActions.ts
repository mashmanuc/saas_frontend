/**
 * TLV2-05B.2 · які віконні дії показати на картці: «— Згорнути · ⛶ Розгорнути · × Видалити».
 *
 * Одне правило для всіх карток — за можливостями типу (`objectStandard`):
 *   • `scale`    — TLV2-05C: вчитель, режим редагування, `textScale: 'teacher-shared'`;
 *                  блокування не заважає (це подання, як і ⛶);
 *   • `minimize` — `canMinimize` (вчитель, режим редагування, `minimizable`);
 *   • `expand`   — вчитель і `fullscreen`; розгортання — лише подання, тож блокування не заважає;
 *   • `delete`   — вчитель, режим редагування, `deletable`, картка НЕ заблокована;
 *   • `handwrite` — LAW §9 v1.29: розв'язок задачі рукою — вчитель, режим редагування (публічний
 *                  перегляд і Replay ставлять стору 'readonly'/'replay'), задача з розв'язком; або
 *                  (етап 1, 18.10) задача без розв'язку, картка чи картинка (вирізка з PDF), яку розв'яже
 *                  Інтегралик, — лише коли кімната дала `canSolve` (власник дошки з Інтеграликом).
 *   • `fitHeight` — «⇕ на всю висоту аркуша» (власник 2026-10-18): вчитель, режим редагування,
 *                  `fitHeight` типу (документ з «Матеріалів»), картка НЕ заблокована (це зміна розміру).
 * Учень не отримує жодної дії. Невідомий тип — жодної (fail-closed стандарту).
 */
import type { WBAsset } from '../types/winterboard'
import { canMinimize, type TrayViewer } from './boardTray'
import { assetCapabilities, isCardAsset } from './objectStandard'
import { hasHandwritableSolution, isIntegralykSolvable } from './handwriteSolution'

export interface CardWindowActions {
  /** TLV2-05C: `A− / 100% / A+` — спільний учительський масштаб тексту. */
  scale: boolean
  minimize: boolean
  expand: boolean
  delete: boolean
  /** LAW §9 v1.29: ✍️ розв'язок задачі рукою (значок без напису). */
  handwrite: boolean
  /** ⇕ документ на всю висоту аркуша біля лівого краю. */
  fitHeight: boolean
}

export const NO_WINDOW_ACTIONS: CardWindowActions = Object.freeze({
  scale: false,
  minimize: false,
  expand: false,
  delete: false,
  handwrite: false,
  fitHeight: false,
})

export function cardWindowActions(
  asset: WBAsset | null | undefined,
  viewer: TrayViewer & { canSolve?: boolean },
): CardWindowActions {
  if (!asset || !viewer.isTutor || !isCardAsset(asset.type)) return NO_WINDOW_ACTIONS
  const caps = assetCapabilities(asset.type)
  return {
    scale: viewer.mode === 'edit' && caps.textScale === 'teacher-shared',
    minimize: canMinimize(asset, viewer),
    expand: caps.fullscreen,
    delete: caps.deletable && viewer.mode === 'edit' && asset.locked !== true,
    handwrite: viewer.mode === 'edit'
      && (hasHandwritableSolution(asset) || (viewer.canSolve === true && isIntegralykSolvable(asset))),
    fitHeight: caps.fitHeight && viewer.mode === 'edit' && asset.locked !== true,
  }
}

/** Чи є що показати в групі взагалі. */
export function hasWindowActions(actions: CardWindowActions): boolean {
  return actions.scale || actions.minimize || actions.expand || actions.delete || actions.handwrite
    || actions.fitHeight
}
