/**
 * useGridOverlay — composable for managing canvas grid/background overlay.
 *
 * Grid types available:
 * - none: clean whiteboard (default)
 * - small-grid: small square cells (~20px) — for precise math work
 * - large-grid: large square cells (~40px) — for general sketching
 * - dots: dot grid — minimal visual noise, popular with tutors
 * - ruled: horizontal ruled lines — for writing practice
 * - coordinate: full coordinate plane with axes + labels — math/physics
 *
 * State is persisted per-session in localStorage.
 * Designed as a platform-level primitive: new grid types can be added
 * without breaking existing code (Additive Architecture Law).
 */

import { ref, computed, watch } from 'vue'
import { useWBStore } from '../board/state/boardStore'
import type { WBPageGridSettings } from '../types/winterboard'

export type GridType = 'none' | 'small-grid' | 'large-grid' | 'dots' | 'ruled' | 'coordinate'

export interface GridOption {
  id: GridType
  nameKey: string
  icon: string
}

// 'coordinate' ПРИБРАНО з меню (2026-07): рендерилось як велика клітинка 40px БЕЗ осей
// (див. gridTypeToSettings — «axes can be added later», не зроблено) → дублікат 'large-grid'
// з оманливим прев'ю. Справжня координатна площина доступна як інструмент. Тип лишаємо у
// GridType (backward-compat зі збереженими значеннями/ops), але не пропонуємо у виборі;
// legacy 'coordinate' плавно мапиться на 'large-grid' у loadGridType.
export const GRID_OPTIONS: GridOption[] = [
  { id: 'none',        nameKey: 'winterboard.grid.none',       icon: 'none' },
  { id: 'small-grid',  nameKey: 'winterboard.grid.smallGrid',  icon: 'small-grid' },
  { id: 'large-grid',  nameKey: 'winterboard.grid.largeGrid',  icon: 'large-grid' },
  { id: 'dots',        nameKey: 'winterboard.grid.dots',       icon: 'dots' },
  { id: 'ruled',       nameKey: 'winterboard.grid.ruled',      icon: 'ruled' },
]

const STORAGE_PREFIX = 'wb_grid_'

function loadGridType(sessionId: string): GridType {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`)
    // Legacy: 'coordinate' прибрано з опцій → мапимо на 'large-grid' (візуально те саме).
    if (saved === 'coordinate') return 'large-grid'
    if (saved && GRID_OPTIONS.some(o => o.id === saved)) {
      return saved as GridType
    }
  } catch {
    // localStorage unavailable — silent fallback
  }
  return 'none'
}

function saveGridType(sessionId: string, gridType: GridType): void {
  try {
    if (gridType === 'none') {
      localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`)
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, gridType)
    }
  } catch {
    // localStorage unavailable — silent fallback
  }
}

/**
 * Convert UI GridType → per-page WBPageGridSettings for usePageGrid / boardStore.
 * 'coordinate' draws a large-grid tile (40px); primary axes can be added as a canvas overlay later.
 */
function gridTypeToSettings(type: GridType): Partial<WBPageGridSettings> {
  switch (type) {
    case 'none':       return { enabled: false }
    case 'small-grid': return { enabled: true, style: 'small-grid', size: 20 }
    case 'large-grid': return { enabled: true, style: 'large-grid', size: 40 }
    case 'dots':       return { enabled: true, style: 'dots',       size: 20 }
    case 'ruled':      return { enabled: true, style: 'ruled',      size: 32 }
    case 'coordinate': return { enabled: true, style: 'coordinate', size: 40 }
    default:           return { enabled: false }
  }
}

export function useGridOverlay(sessionId: string) {
  const gridType = ref<GridType>(loadGridType(sessionId))
  const wbStore = useWBStore()

  const isGridActive = computed(() => gridType.value !== 'none')

  const currentOption = computed(() =>
    GRID_OPTIONS.find(o => o.id === gridType.value) ?? GRID_OPTIONS[0],
  )

  // Persist to localStorage AND sync to per-page grid settings (Konva renderer)
  // BUG-1 FIX: immediate:true ensures grid state syncs to store on mount
  watch(gridType, (val) => {
    saveGridType(sessionId, val)
    wbStore.updateCurrentPageGrid(gridTypeToSettings(val))
  }, { immediate: true })

  // Re-apply grid after session loads (race condition fix)
  // The immediate watch above fires before pages[] are hydrated from backend,
  // so updateCurrentPageGrid operates on the initial empty page — not the session's pages.
  // This watch fires when workspaceId changes (session loaded/created) and
  // re-applies the user's grid preference to the now-hydrated current page.
  // Watching workspaceId avoids the infinite loop that watching currentPage caused:
  // updateCurrentPageGrid creates a new page object reference, which would
  // re-trigger a currentPage watch on every call.
  watch(
    () => wbStore.workspaceId,
    (id) => {
      if (id) {
        wbStore.updateCurrentPageGrid(gridTypeToSettings(gridType.value))
      }
    },
  )

  function setGrid(type: GridType, applyToAll = false): void {
    // Зміна gridType → watch застосує до ПОТОЧНОЇ сторінки + збереже session-пref.
    gridType.value = type
    // «Усі сторінки»: застосувати той самий стиль до КОЖНОЇ сторінки (per-page grid_update
    // op через updatePageGrid — LAW-сумісно, як background_update). Поточна сторінка отримає
    // ще один (ідемпотентний) update від watch — це один зайвий op на клік, не шторм.
    if (applyToAll) {
      const settings = gridTypeToSettings(type)
      for (const page of wbStore.pages) {
        if (page.id) wbStore.updatePageGrid(page.id, settings)
      }
    }
  }

  function toggleGrid(): void {
    gridType.value = gridType.value === 'none' ? 'small-grid' : 'none'
  }

  function cycleGrid(): void {
    const idx = GRID_OPTIONS.findIndex(o => o.id === gridType.value)
    const next = (idx + 1) % GRID_OPTIONS.length
    gridType.value = GRID_OPTIONS[next].id
  }

  return {
    gridType,
    isGridActive,
    currentOption,
    setGrid,
    toggleGrid,
    cycleGrid,
  }
}
