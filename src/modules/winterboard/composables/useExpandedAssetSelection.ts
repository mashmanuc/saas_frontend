/**
 * ІНВАРІАНТ INV-EXPAND-SELECTED (2026-08-16):
 * розгорнутий на всю сторінку об'єкт ЗАВЖДИ виділений, поки він на поточній
 * сторінці.
 *
 * Навіщо. Виділення — єдиний шлях, яким renderer реєструє свій sidebar-інспектор
 * (`watch(isSelected)` → register*Inspector у GraphCalculator / Nmt3d / Helix /
 * TrigCircle / …). Тому правило читається як «розгорнуто → праворуч інспектор»,
 * і воно одне закриває дві діри, знайдені у живому прогоні власника:
 *
 *  1. Перехід на іншу сторінку і назад. Watcher зміни сторінки у WBCanvas
 *     свідомо робить clearSelection() (інакше Konva-трансформер малює привид на
 *     новій сторінці), а `expandedAssetId` перехід переживає — власник
 *     повертався до розгорнутого об'єкта БЕЗ інспектора і без способу його
 *     покликати: кліки всередині розгорнутого оверлея select-guard пропускає
 *     свідомо (оверлей покриває полотно).
 *
 *  2. Legacy-гілка рендеру (`unifiedRenderEnabled === false` — саме вона у
 *     білді без `VITE_UNIFIED_ZORDER`): її шість `@expand="expandedAssetId = …"`
 *     ніколи не виділяли об'єкт, тобто інспектор не з'являвся навіть при
 *     першому розгортанні. Auto-select з e2fe8c7d додали лише у WBOverlayLayer.
 *
 * Тому інваріант живе у спільному предку обох гілок (WBCanvas), а не в оверлеї.
 *
 * Ціна. Виділення — чистий UI-стан: `selectItems` не емітить ops, тому
 * перевиділення не породжує ні реплей-подій, ні WS-трафіку.
 */
import { computed, watch } from 'vue'
import type { WatchStopHandle } from 'vue'

/** Мінімальний контракт стора — рівно те, що інваріанту треба (тестовно). */
export interface ExpandedSelectionStore {
  expandedAssetId: string | null
  selectedIds: string[]
  currentPageIndex: number
  pages: Array<{ assets?: Array<{ id: string }> }>
  selectItems(ids: string[]): void
}

export function useExpandedAssetSelection(store: ExpandedSelectionStore): WatchStopHandle {
  /**
   * Джерело «яка зараз сторінка» — СТОР, не `props.assets` компонента: під час
   * переходу сторінки живе fade (~180ms), протягом якого props ще від
   * попередньої. Читаючи props, watcher бачив стару сторінку, вважав
   * розгорнутий об'єкт присутнім і повертав щойно очищене виділення — на новій
   * сторінці лишався фантомний selection об'єкта, якого там немає (виміряно
   * живцем: sel=[gc-…] на сторінці 4, де такого об'єкта немає).
   */
  const expandedAssetOnThisPage = computed(() => {
    const id = store.expandedAssetId
    if (!id) return false
    const page = store.pages[store.currentPageIndex]
    return !!page?.assets?.some((a) => a.id === id)
  })

  return watch(
    [expandedAssetOnThisPage, () => store.selectedIds],
    ([onPage, selected]) => {
      const id = store.expandedAssetId
      if (!onPage || !id) return
      // Уже виділений (сам або у групі) → інспектор зареєстрований, не чіпаємо.
      if (selected.includes(id)) return
      store.selectItems([id])
    },
    // flush:'post' — не втручатись у середину рендер-циклу зміни сторінки.
    { immediate: true, flush: 'post' },
  )
}
