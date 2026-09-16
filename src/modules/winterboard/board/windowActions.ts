/**
 * TLV2-05B.2 · які віконні дії показати на картці: «— Згорнути · ⛶ Розгорнути · × Видалити».
 *
 * Одне правило для всіх карток — за можливостями типу (`objectStandard`):
 *   • `scale`    — TLV2-05C: вчитель, режим редагування, `textScale: 'teacher-shared'`;
 *                  блокування не заважає (це подання, як і ⛶);
 *   • `minimize` — `canMinimize` (вчитель, режим редагування, `minimizable`);
 *   • `expand`   — вчитель і `fullscreen`; розгортання — лише подання, тож блокування не заважає;
 *   • `delete`   — вчитель, режим редагування, `deletable`, картка НЕ заблокована.
 * Учень не отримує жодної дії. Невідомий тип — жодної (fail-closed стандарту).
 */
import type { WBAsset } from '../types/winterboard'
import { canMinimize, type TrayViewer } from './boardTray'
import { assetCapabilities, isCardAsset } from './objectStandard'

export interface CardWindowActions {
  /** TLV2-05C: `A− / 100% / A+` — спільний учительський масштаб тексту. */
  scale: boolean
  minimize: boolean
  expand: boolean
  delete: boolean
}

export const NO_WINDOW_ACTIONS: CardWindowActions = Object.freeze({
  scale: false,
  minimize: false,
  expand: false,
  delete: false,
})

export function cardWindowActions(
  asset: WBAsset | null | undefined,
  viewer: TrayViewer,
): CardWindowActions {
  if (!asset || !viewer.isTutor || !isCardAsset(asset.type)) return NO_WINDOW_ACTIONS
  const caps = assetCapabilities(asset.type)
  return {
    scale: viewer.mode === 'edit' && caps.textScale === 'teacher-shared',
    minimize: canMinimize(asset, viewer),
    expand: caps.fullscreen,
    delete: caps.deletable && viewer.mode === 'edit' && asset.locked !== true,
  }
}

/** Чи є що показати в групі взагалі. */
export function hasWindowActions(actions: CardWindowActions): boolean {
  return actions.scale || actions.minimize || actions.expand || actions.delete
}
