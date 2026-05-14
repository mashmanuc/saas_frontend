/**
 * Phase 1A (Plan v1.1): Tests для assetsEqualByOpsFields whitelist comparison.
 *
 * Plan ref: saas_docs/plans/classroom/CORE_UPDATEASSET_STABILIZATION_PLAN_2026-05-04.md §6.1
 * Module: board/state/assetEquality.ts
 *
 * Coverage matrix:
 *   - identical → equal (true)
 *   - top-level field diff (each tracked field) → not equal (false)
 *   - whitelisted nested field diff (content_ref.*, data.state.*) → not equal
 *   - non-whitelisted field diff (status, errorMessage, pages, lockedBy noise) → equal
 *     (FE-only fields are ignored — that's the whitelist contract)
 *   - undefined/null edge cases (one has data, other doesn't)
 */
import { describe, it, expect } from 'vitest'
import { assetsEqualByOpsFields } from '../board/state/assetEquality'
import type { WBAsset, SolidAsset, SolidAssetState } from '../types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeImageAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: 'asset-1',
    type: 'image',
    src: 'https://images.example.com/foo.png',
    x: 100,
    y: 200,
    w: 300,
    h: 400,
    rotation: 0,
    locked: false,
    ...overrides,
  }
}

function makeDocViewerAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: 'docviewer-1',
    type: 'document_viewer',
    src: 'https://images.example.com/page_1.png',
    x: 0, y: 0, w: 420, h: 594,
    rotation: 0,
    content_ref: {
      content_id: 1400,
      content_type: 'pdf',
    },
    currentPage: 0,
    totalPages: 238,
    viewerMode: 'compact',
    ...overrides,
  }
}

function makeSolidAsset(stateOverrides: Partial<SolidAssetState> = {}): SolidAsset {
  const defaultState: SolidAssetState = {
    showFaces: true,
    showEdges: true,
    showVertices: false,
    transparent: false,
    showNet: false,
    showCut: false,
    cutHeight: 0.5,
    autoRotate: true,
  }
  return {
    id: 'solid-1',
    type: 'geometry_solid',
    src: 'cube',
    x: 100, y: 100, w: 280, h: 280,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: { ...defaultState, ...stateOverrides },
    },
  }
}

// ─── Identical assets → equal ────────────────────────────────────────────────

describe('assetsEqualByOpsFields — identical → equal', () => {
  it('identical image asset (same reference)', () => {
    const a = makeImageAsset()
    expect(assetsEqualByOpsFields(a, a)).toBe(true)
  })

  it('identical image asset (different references, same values)', () => {
    const a = makeImageAsset()
    const b = makeImageAsset()
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('identical document_viewer (deep nested content_ref equal)', () => {
    const a = makeDocViewerAsset()
    const b = makeDocViewerAsset()
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('identical solid asset (deep nested data.state equal)', () => {
    const a = makeSolidAsset()
    const b = makeSolidAsset()
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })
})

// ─── Top-level field changes → not equal ─────────────────────────────────────

describe('assetsEqualByOpsFields — top-level field diff → not equal', () => {
  it.each([
    ['x', { x: 999 }],
    ['y', { y: 999 }],
    ['w', { w: 999 }],
    ['h', { h: 999 }],
    ['rotation', { rotation: 45 }],
    ['locked', { locked: true }],
    ['src', { src: 'different.png' }],
    ['type', { type: 'sticky' as const }],
    ['opacity', { opacity: 0.5 }],
    ['borderRadius', { borderRadius: 10 }],
    ['title', { title: 'New Title' }],
    ['fontSize', { fontSize: 24 }],
    ['textAlign', { textAlign: 'center' }],
    ['audioUrl', { audioUrl: 'https://audio.example.com/x.mp3' }],
    ['audioDuration', { audioDuration: 12.5 }],
    ['youtubeUrl', { youtubeUrl: 'https://youtube.com/watch?v=xyz' }],
    ['duration', { duration: 30 }],
    ['thumbnail', { thumbnail: 'thumb.png' }],
  ])('rejects when %s differs', (_name, diff) => {
    const a = makeImageAsset()
    const b = makeImageAsset(diff as Partial<WBAsset>)
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when DocViewer currentPage differs', () => {
    const a = makeDocViewerAsset({ currentPage: 0 })
    const b = makeDocViewerAsset({ currentPage: 5 })
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when DocViewer totalPages differs', () => {
    const a = makeDocViewerAsset({ totalPages: 238 })
    const b = makeDocViewerAsset({ totalPages: 100 })
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when DocViewer viewerMode differs', () => {
    const a = makeDocViewerAsset({ viewerMode: 'compact' })
    const b = makeDocViewerAsset({ viewerMode: 'expanded' })
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })
})

// ─── Nested content_ref changes → not equal ─────────────────────────────────

describe('assetsEqualByOpsFields — content_ref nested diff → not equal', () => {
  it('rejects when content_ref.content_id differs', () => {
    const a = makeDocViewerAsset()
    const b = makeDocViewerAsset({
      content_ref: { content_id: 999, content_type: 'pdf' },
    })
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when content_ref.content_type differs', () => {
    const a = makeDocViewerAsset()
    const b = makeDocViewerAsset({
      content_ref: { content_id: 1400, content_type: 'presentation' },
    })
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when one has content_ref, other has undefined', () => {
    const a = makeDocViewerAsset({ content_ref: undefined })
    const b = makeDocViewerAsset()
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })
})

// ─── SolidAsset.data.state nested → not equal ───────────────────────────────

describe('assetsEqualByOpsFields — SolidAsset data.state diff → not equal', () => {
  it.each([
    ['showFaces', { showFaces: false }],
    ['showEdges', { showEdges: false }],
    ['showVertices', { showVertices: true }],
    ['transparent', { transparent: true }],
    ['showNet', { showNet: true }],
    ['showCut', { showCut: true }],
    ['cutHeight', { cutHeight: 0.9 }],
    ['autoRotate', { autoRotate: false }],
  ])('rejects when state.%s differs', (_name, diff) => {
    const a = makeSolidAsset()
    const b = makeSolidAsset(diff as Partial<SolidAssetState>)
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when data.version differs', () => {
    const a = makeSolidAsset()
    // Type literal `1` only (per SolidAssetData), use unknown cast щоб симулювати legacy/future schema
    const b: SolidAsset = {
      ...makeSolidAsset(),
      data: { version: 2 as unknown as 1, state: a.data!.state },
    }
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })

  it('rejects when one has data, other does not', () => {
    const withData = makeSolidAsset()
    const withoutData: WBAsset = { ...withData, data: undefined }
    expect(assetsEqualByOpsFields(withData, withoutData)).toBe(false)
  })
})

// ─── Non-whitelisted fields (FE-only) → still equal ──────────────────────────

describe('assetsEqualByOpsFields — non-whitelisted fields ignored → equal', () => {
  it('ignores `status` field (FE-only per types comments)', () => {
    const a = makeImageAsset({ status: 'uploading' })
    const b = makeImageAsset({ status: 'ready' })
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('ignores `errorMessage` field (FE-only)', () => {
    const a = makeImageAsset({ errorMessage: 'Upload failed' })
    const b = makeImageAsset({ errorMessage: undefined })
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('ignores `pages` field (DocViewer hydration cache, NOT in WS/state)', () => {
    const a = makeDocViewerAsset({
      pages: [{ index: 0, url: 'page1.png' }],
    })
    const b = makeDocViewerAsset({ pages: undefined })
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

})

// ─── Critical regression scenarios ──────────────────────────────────────────

describe('assetsEqualByOpsFields — regression scenarios from plan §6', () => {
  it('Konva transformend duplicate (scale reset → re-fire) — same final values', () => {
    // Симуляція: handleAssetTransformEnd reset scaleX/Y до 1 і emit з final w/h.
    // Якщо Konva fire ще раз з ТИМИ САМИМИ values — Layer A skip це.
    const a = makeImageAsset({ x: 50, y: 50, w: 200, h: 150, rotation: 0 })
    const b = makeImageAsset({ x: 50, y: 50, w: 200, h: 150, rotation: 0 })
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('async image load completion does NOT change ops fields', () => {
    // DocumentViewerAsset loadCurrentPage встановлює currentPageImage.value (FE-only ref).
    // Сам asset prop НЕ міняється → comparison MUST return true.
    const a = makeDocViewerAsset({ currentPage: 0 })
    const b = makeDocViewerAsset({ currentPage: 0 })
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('rapid drag move (60 FPS same position) — duplicate emissions equal', () => {
    // pointermove fires 60x/sec на static cursor → same x/y/w/h emit.
    const a = makeImageAsset({ x: 100, y: 200 })
    const b = makeImageAsset({ x: 100, y: 200 })
    expect(assetsEqualByOpsFields(a, b)).toBe(true)
  })

  it('drag move with delta — NOT equal (must emit op)', () => {
    const a = makeImageAsset({ x: 100, y: 200 })
    const b = makeImageAsset({ x: 105, y: 200 })  // moved 5px
    expect(assetsEqualByOpsFields(a, b)).toBe(false)
  })
})
