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

export type GridType = 'none' | 'small-grid' | 'large-grid' | 'dots' | 'ruled' | 'coordinate'

export interface GridOption {
  id: GridType
  nameKey: string
  icon: string
}

export const GRID_OPTIONS: GridOption[] = [
  { id: 'none',        nameKey: 'winterboard.grid.none',       icon: 'none' },
  { id: 'small-grid',  nameKey: 'winterboard.grid.smallGrid',  icon: 'small-grid' },
  { id: 'large-grid',  nameKey: 'winterboard.grid.largeGrid',  icon: 'large-grid' },
  { id: 'dots',        nameKey: 'winterboard.grid.dots',       icon: 'dots' },
  { id: 'ruled',       nameKey: 'winterboard.grid.ruled',      icon: 'ruled' },
  { id: 'coordinate',  nameKey: 'winterboard.grid.coordinate', icon: 'coordinate' },
]

const STORAGE_PREFIX = 'wb_grid_'

function loadGridType(sessionId: string): GridType {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`)
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

export function useGridOverlay(sessionId: string) {
  const gridType = ref<GridType>(loadGridType(sessionId))

  const isGridActive = computed(() => gridType.value !== 'none')

  const currentOption = computed(() =>
    GRID_OPTIONS.find(o => o.id === gridType.value) ?? GRID_OPTIONS[0],
  )

  watch(gridType, (val) => {
    saveGridType(sessionId, val)
  })

  function setGrid(type: GridType): void {
    gridType.value = type
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
