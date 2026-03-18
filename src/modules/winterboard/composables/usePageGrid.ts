// usePageGrid — per-page grid composable for Winterboard
// Ref: responsive/prompts/active/DAY12-13_PHASE6.md A9
//
// Bug fixes:
//   BUG-1: Grid was global (localStorage per-session) → now per-page (stored in page.grid)
//   BUG-2: Grid opacity too low on video conferences → default opacity 0.15, color #000000
//
// Architecture:
//   - currentPageGrid computed reads from wbStore.currentPage.grid (per-page SSOT)
//   - watch triggers _applyGridToCanvas → generates canvas tile → wbStore.setGridPattern(dataUrl)
//   - WBCanvas.vue watches gridPatternDataUrl → loads HTMLImageElement → Konva fillPatternImage

import { computed, watch } from 'vue'
import { useWBStore } from '../board/state/boardStore'
import type { WBPageGridSettings, GridStyle } from '../types/winterboard'

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_GRID: WBPageGridSettings = {
  enabled: false,
  size: 20,
  style: 'dots',
  color: '#000000',
  // 0.4 = clearly visible on white AND readable on video conference backgrounds
  // (was 0.15 — too faint, barely perceptible)
  opacity: 0.4,
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function usePageGrid() {
  const wbStore = useWBStore()

  /**
   * Resolved grid settings for the current page.
   * Falls back to DEFAULT_PAGE_GRID fields for any missing property.
   */
  const currentPageGrid = computed((): WBPageGridSettings => {
    const page = wbStore.currentPage
    if (!page || !page.grid) return { ...DEFAULT_PAGE_GRID }
    return {
      enabled:  page.grid.enabled  ?? DEFAULT_PAGE_GRID.enabled,
      size:     page.grid.size     ?? DEFAULT_PAGE_GRID.size,
      style:   (page.grid.style    as GridStyle) ?? DEFAULT_PAGE_GRID.style,
      color:    page.grid.color   ?? DEFAULT_PAGE_GRID.color,
      opacity:  page.grid.opacity  ?? DEFAULT_PAGE_GRID.opacity,
    }
  })

  /**
   * Persist updates to the current page's grid settings.
   * Triggers store action which marks board dirty for autosave.
   */
  function updatePageGrid(updates: Partial<WBPageGridSettings>): void {
    wbStore.updateCurrentPageGrid(updates)
  }

  // Re-generate the canvas tile pattern whenever the current page grid changes.
  // immediate:true ensures the pattern is rendered on first mount.
  watch(
    currentPageGrid,
    (grid) => { _applyGridToCanvas(wbStore, grid) },
    { immediate: true, deep: true },
  )

  return {
    currentPageGrid,
    updatePageGrid,
    /** Read-only reference to the default values */
    defaultGrid: { ...DEFAULT_PAGE_GRID } as Readonly<WBPageGridSettings>,
  }
}

// ─── Internal: canvas tile generator ────────────────────────────────────────

/**
 * Generate a small canvas tile representing one grid cell and store its
 * dataURL in the board store.  WBCanvas.vue loads this into an HTMLImageElement
 * and renders it as a Konva fillPatternImage (tiled across the page).
 *
 * @internal Not exported — only called by the watcher above.
 */
export function _applyGridToCanvas(
  wbStore: ReturnType<typeof useWBStore>,
  grid: WBPageGridSettings,
): void {
  if (!grid.enabled) {
    wbStore.setGridPattern(null)
    return
  }

  // SSR guard — document unavailable in Node.js
  if (typeof document === 'undefined') return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { size, style, color, opacity } = grid
  canvas.width  = size
  canvas.height = size

  ctx.clearRect(0, 0, size, size)
  ctx.globalAlpha = opacity

  if (style === 'dots') {
    // Single dot centred in the tile — radius 1.5px for clear visibility
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
  } else if (style === 'small-grid') {
    // Thin grid lines — tile size 20px
    // Use 1px lines so globalAlpha still produces visible result at opacity 0.4
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(size, 0);    ctx.lineTo(size, size)   // right edge
    ctx.moveTo(0,    size); ctx.lineTo(size, size)   // bottom edge
    ctx.stroke()
  } else if (style === 'large-grid') {
    // Larger grid lines — tile size 40px
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(size, 0);    ctx.lineTo(size, size)   // right edge
    ctx.moveTo(0,    size); ctx.lineTo(size, size)   // bottom edge
    ctx.stroke()
  } else if (style === 'ruled') {
    // Horizontal ruled lines only — blue tint
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(0, size); ctx.lineTo(size, size)      // bottom edge only
    ctx.stroke()
  } else if (style === 'coordinate') {
    // Coordinate plane tile: two-level grid (5 minor cells per major cell)
    // Major cell = tile size (40px); minor cell = 8px
    // Visually identical to classic coordinate/graph paper
    const minor = Math.round(size / 5)   // 40 / 5 = 8px

    // Minor grid lines — very light, inside the major cell
    ctx.strokeStyle = '#cbd5e1'   // slate-300 (lighter)
    ctx.lineWidth = 0.5
    ctx.globalAlpha = opacity * 0.5
    ctx.beginPath()
    for (let i = minor; i < size; i += minor) {
      ctx.moveTo(i, 0);    ctx.lineTo(i, size)   // vertical minor
      ctx.moveTo(0, i);    ctx.lineTo(size, i)   // horizontal minor
    }
    ctx.stroke()

    // Major grid lines at tile boundary — darker, full opacity
    ctx.strokeStyle = '#94a3b8'   // slate-400
    ctx.lineWidth = 1
    ctx.globalAlpha = opacity
    ctx.beginPath()
    ctx.moveTo(size, 0);    ctx.lineTo(size, size)   // right edge
    ctx.moveTo(0,    size); ctx.lineTo(size, size)   // bottom edge
    ctx.stroke()
  } else {
    // 'lines' (legacy) — draw right edge + bottom edge; tiling produces a grid
    ctx.strokeStyle = color
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(size, 0);    ctx.lineTo(size, size)   // right edge
    ctx.moveTo(0,    size); ctx.lineTo(size, size)   // bottom edge
    ctx.stroke()
  }

  wbStore.setGridPattern(canvas.toDataURL())
}
