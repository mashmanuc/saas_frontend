// WB5 A9: Sticky notes composable — create, update text/color/fontSize/position/dimensions
// Ref: TASK_BOARD_V5.md A9

import { computed } from 'vue'
import type { useWBStore } from '../board/state/boardStore'
import type { WBAsset, WBStickyNote } from '../types/winterboard'
import { STICKY_DEFAULTS } from '../types/winterboard'

// ─── Types ───────────────────────────────────────────────────────────────────

type WBStore = ReturnType<typeof useWBStore>

function generateStickyId(): string {
  return `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useStickyNotes(store: WBStore) {
  /**
   * Create a sticky note at the given position.
   * Returns the new sticky ID.
   */
  function createSticky(x: number, y: number, bgColor?: string): string {
    const sticky: WBAsset = {
      id: generateStickyId(),
      type: 'sticky',
      src: '',
      x,
      y,
      w: STICKY_DEFAULTS.width,
      h: STICKY_DEFAULTS.height,
      rotation: 0,
      text: STICKY_DEFAULTS.text,
      bgColor: bgColor ?? STICKY_DEFAULTS.bgColor,
      textColor: STICKY_DEFAULTS.textColor,
      fontSize: STICKY_DEFAULTS.fontSize,
    }
    store.addStickyNote(sticky)
    return sticky.id
  }

  /**
   * Update sticky text. Max 500 chars, locked check in store.
   */
  function updateText(id: string, text: string): void {
    store.updateStickyText(id, text)
  }

  /**
   * Update sticky background color.
   */
  function updateColor(id: string, bgColor: string): void {
    store.updateStickyStyle(id, { bgColor })
  }

  /**
   * Update sticky font size. Clamped 10-32 in store.
   */
  function updateFontSize(id: string, fontSize: number): void {
    store.updateStickyStyle(id, { fontSize })
  }

  /**
   * Update sticky position via updateAsset (uses existing asset undo).
   */
  function updatePosition(id: string, x: number, y: number): void {
    const page = store.currentPage
    if (!page) return
    const asset = page.assets.find((a) => a.id === id)
    if (!asset || asset.type !== 'sticky') return
    if (asset.locked) return
    store.updateAsset({ ...asset, x, y })
  }

  /**
   * Update sticky dimensions. Clamped 50-800.
   */
  function updateDimensions(id: string, w: number, h: number): void {
    const page = store.currentPage
    if (!page) return
    const asset = page.assets.find((a) => a.id === id)
    if (!asset || asset.type !== 'sticky') return
    if (asset.locked) return
    const clampedW = Math.max(50, Math.min(800, w))
    const clampedH = Math.max(50, Math.min(800, h))
    store.updateAsset({ ...asset, w: clampedW, h: clampedH })
  }

  /**
   * Computed: sticky notes on the current page.
   */
  const currentPageStickies = computed((): WBStickyNote[] => {
    const page = store.currentPage
    if (!page) return []
    return page.assets.filter((a): a is WBStickyNote => a.type === 'sticky')
  })

  return {
    createSticky,
    updateText,
    updateColor,
    updateFontSize,
    updatePosition,
    updateDimensions,
    currentPageStickies,
  }
}
