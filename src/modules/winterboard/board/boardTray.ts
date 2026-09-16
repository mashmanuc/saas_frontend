/**
 * TLV2-05B · НИЖНІЙ ТРЕЙ — спільні правила згортання карток.
 *
 * Трей НЕ полиця: полиця створює новий об'єкт, трей тримає вже наявний, тимчасово
 * згорнутий об'єкт поточної сторінки.
 *
 * Що таке «згорнути»:
 *   • той самий об'єкт (`id`, геометрія, шар у `page.assets[]`, `locked`, `data`) —
 *     змінюється РІВНО одне поле `minimized`;
 *   • запис — штатний `asset_update` через host (`WBCanvas` → `asset-update` →
 *     кімната → `store.updateAsset`). Другого шляху запису немає;
 *   • ховати/показувати — за даними (`isMinimizedOnBoard`), тому учень, reload,
 *     replay і клон у кімнату бачать те саме, що сформував учитель.
 *
 * Тут немає окремого коду для теорії, задачі, Geometry2D чи капсули: тип лише
 * декларує `minimizable` у `objectStandard.ts`.
 */
import type { WBAsset } from '../types/winterboard'
import { isMinimizableAsset, isMinimizedOnBoard } from './objectStandard'

export interface TrayViewer {
  /** Роль глядача від host-а кімнати (`WBCanvas.isTutor`). */
  isTutor: boolean
  /** `wbStore.mode`: трей керується лише в режимі редагування. */
  mode: string
}

/**
 * Згорнуті картки сторінки — у порядку шарів (`page.assets[]`).
 * Детерміновано й без часових міток; один об'єкт — одна вкладка.
 */
export function trayItems(pageAssets: readonly WBAsset[]): WBAsset[] {
  const seen = new Set<string>()
  const items: WBAsset[] = []
  for (const asset of pageAssets) {
    if (!isMinimizedOnBoard(asset) || seen.has(asset.id)) continue
    seen.add(asset.id)
    items.push(asset)
  }
  return items
}

/** Трей бачить лише вчитель у режимі редагування — і лише коли в ньому щось є. */
export function canShowTray(viewer: TrayViewer, itemCount: number): boolean {
  return viewer.isTutor && viewer.mode === 'edit' && itemCount > 0
}

/**
 * Чи доступна дія «Згорнути» для картки.
 * `enabled` — прапорець `isBoardTrayEnabled()`: у V1 дія вимкнена за замовчуванням.
 */
export function canMinimize(
  asset: WBAsset | null | undefined,
  viewer: TrayViewer,
  enabled: boolean,
): boolean {
  return enabled
    && viewer.isTutor
    && viewer.mode === 'edit'
    && !!asset
    && isMinimizableAsset(asset.type)
    && asset.minimized !== true
}

/** Згорнути: той самий об'єкт, змінюється лише `minimized`. */
export function minimizedAsset(asset: WBAsset): WBAsset {
  return { ...asset, minimized: true }
}

/** Відновити: той самий об'єкт на тому самому місці, звичайний frame (не fullscreen). */
export function restoredAsset(asset: WBAsset): WBAsset {
  return { ...asset, minimized: false }
}

const TITLE_MAX = 40

/** Назва для вкладки: з даних картки, коротко; без назви — лише підпис типу. */
export function trayTitle(asset: WBAsset): string {
  const data = (asset.data ?? {}) as Record<string, unknown>
  const raw = [data.title, asset.title, data.question]
    .find((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (!raw) return ''
  const plain = raw.replace(/\s+/g, ' ').trim()
  return plain.length > TITLE_MAX ? `${plain.slice(0, TITLE_MAX - 1)}…` : plain
}
