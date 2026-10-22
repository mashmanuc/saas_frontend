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
    // Phase 35: Use wbStore.gridSize as fallback instead of hardcoded DEFAULT_PAGE_GRID.size
    const fallbackSize = wbStore.gridSize ?? DEFAULT_PAGE_GRID.size
    if (!page || !page.grid) return { ...DEFAULT_PAGE_GRID, size: fallbackSize }
    return {
      enabled:  page.grid.enabled  ?? DEFAULT_PAGE_GRID.enabled,
      size:     page.grid.size     ?? fallbackSize,
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

// ─── Зошитові види: клітинка, лінійка, коса лінія ───────────────────────────

/** Синя лінія зошита. Масштаб дошки — як у лінійки: 1 мм = 4 px (клітинка 20 px = 5 мм). */
export const NOTEBOOK_INK = '#2f6fd0'

const NOTEBOOK_STYLES: ReadonlySet<GridStyle> = new Set<GridStyle>(['small-grid', 'large-grid', 'ruled', 'slanted'])

/**
 * Коса лінія (письмо в 1–2 класі): рядок 4 мм, між рядками 6 мм, похилі під ~65° — нахил письма.
 * Плитка — два рядки заввишки (80 px) і крок похилих завширшки (37 px): за 80 px похила
 * зсувається рівно на 37 px, тож на межах плиток лінії не рвуться (atan(80/37) ≈ 65,2°).
 */
export const SLANTED_ROW_PX = 16
export const SLANTED_GAP_PX = 24
export const SLANTED_TILE_W = 37
export const SLANTED_TILE_H = 2 * (SLANTED_ROW_PX + SLANTED_GAP_PX)

function drawNotebookTile(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  style: GridStyle,
  size: number,
): void {
  // Розмір полотна скидає стан контексту — колір і товщину ставимо після нього.
  if (style === 'slanted') {
    canvas.width = SLANTED_TILE_W
    canvas.height = SLANTED_TILE_H
    ctx.strokeStyle = NOTEBOOK_INK
    ctx.lineWidth = 1
    // Похилі світліші за рядки, як у зошиті. Сусідні копії (±ширина) докреслюють кути плитки.
    ctx.globalAlpha = 0.3
    ctx.beginPath()
    for (const dx of [-SLANTED_TILE_W, 0, SLANTED_TILE_W]) {
      ctx.moveTo(dx, SLANTED_TILE_H)
      ctx.lineTo(dx + SLANTED_TILE_W, 0)
    }
    ctx.stroke()
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    for (let top = SLANTED_GAP_PX / 2; top < SLANTED_TILE_H; top += SLANTED_ROW_PX + SLANTED_GAP_PX) {
      for (const y of [top, top + SLANTED_ROW_PX]) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(SLANTED_TILE_W, y + 0.5)
      }
    }
    ctx.stroke()
    return
  }
  canvas.width = size
  canvas.height = size
  ctx.strokeStyle = NOTEBOOK_INK
  ctx.lineWidth = 1
  ctx.globalAlpha = style === 'ruled' ? 0.6 : 0.4
  // Лінія на пів пікселя всередині плитки: на самому краю видно лише її половину.
  const edge = size - 0.5
  ctx.beginPath()
  if (style !== 'ruled') {
    ctx.moveTo(edge, 0)
    ctx.lineTo(edge, size)
  }
  ctx.moveTo(0, edge)
  ctx.lineTo(size, edge)
  ctx.stroke()
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

  // Зошитові види — сині лінії «як у зошиті» (власник 2026-10-22: «зробити менш прозорим, щоб
  // видно було… лінійка синя має бути, як зошит»). БУЛО: світло-сіра лінія під прозорістю 0,4 ще й
  // на самому краю плитки (видно лише її половину) — на проєкторі й у відеозв'язку клітинки майже
  // не було. Колір і прозорість — від виду, не від збереженого `opacity`: інакше старі сторінки
  // лишилися б блідими.
  if (NOTEBOOK_STYLES.has(style)) {
    drawNotebookTile(canvas, ctx, style, size)
    wbStore.setGridPattern(canvas.toDataURL())
    return
  }

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
