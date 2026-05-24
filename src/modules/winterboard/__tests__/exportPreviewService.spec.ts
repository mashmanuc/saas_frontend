/**
 * Tests для exportPreviewService — orchestration layer для widget preview capture.
 *
 * Покриває PR-2 reviewer guards:
 *   - Registry lifecycle (register / unregister / hasCapture)
 *   - Bounded parallelism (MAX_CONCURRENT_CAPTURES=4 default)
 *   - Per-widget timeout isolation (failed widget → null, others continue)
 *   - Abort propagation (cancel mid-capture stops everything)
 *   - INV-EP-3: failures NEVER throw to caller
 *
 * Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    uploadExportPreview: vi.fn(),
  },
}))

import { exportPreviewService } from '../services/exportPreviewService'
import { winterboardApi } from '../api/winterboardApi'

describe('exportPreviewService — registry lifecycle', () => {
  beforeEach(() => {
    exportPreviewService._resetForTests()
  })

  it('register adds capture fn, hasCapture returns true', () => {
    exportPreviewService.register('asset-1', async () => null)
    expect(exportPreviewService.hasCapture('asset-1')).toBe(true)
    expect(exportPreviewService.registeredAssetIds).toContain('asset-1')
  })

  it('unregister removes the entry', () => {
    exportPreviewService.register('asset-2', async () => null)
    exportPreviewService.unregister('asset-2')
    expect(exportPreviewService.hasCapture('asset-2')).toBe(false)
  })

  it('empty / null asset ids are silently ignored', () => {
    exportPreviewService.register('', async () => null)
    exportPreviewService.register(null as any, async () => null)
    expect(exportPreviewService.registeredAssetIds).toEqual([])
  })

  it('re-register replaces previous capture fn', async () => {
    const fn1 = vi.fn(async () => ({ blob: new Blob(), width: 1, height: 1 }))
    const fn2 = vi.fn(async () => ({ blob: new Blob(), width: 1, height: 1 }))
    exportPreviewService.register('a', fn1)
    exportPreviewService.register('a', fn2)

    const ctrl = new AbortController()
    await exportPreviewService.captureAll(['a'], ctrl.signal)
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })
})

describe('exportPreviewService — captureAll', () => {
  beforeEach(() => {
    exportPreviewService._resetForTests()
    vi.useRealTimers()
  })

  it('captures registered assets, skips unregistered', async () => {
    exportPreviewService.register('a', async () => ({
      blob: new Blob(['a'], { type: 'image/png' }),
      width: 10,
      height: 10,
    }))
    exportPreviewService.register('b', async () => ({
      blob: new Blob(['b'], { type: 'image/png' }),
      width: 20,
      height: 20,
    }))

    const ctrl = new AbortController()
    const result = await exportPreviewService.captureAll(['a', 'b', 'c'], ctrl.signal)

    expect(result.captured.size).toBe(2)
    expect(result.captured.get('a')?.width).toBe(10)
    expect(result.captured.get('b')?.height).toBe(20)
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual(['c'])
  })

  it('failure of one widget does NOT block others (INV-EP-3)', async () => {
    exportPreviewService.register('ok1', async () => ({
      blob: new Blob(), width: 1, height: 1,
    }))
    exportPreviewService.register('bad', async () => {
      throw new Error('boom')
    })
    exportPreviewService.register('ok2', async () => ({
      blob: new Blob(), width: 2, height: 2,
    }))

    const ctrl = new AbortController()
    const result = await exportPreviewService.captureAll(
      ['ok1', 'bad', 'ok2'], ctrl.signal,
    )

    expect(result.captured.size).toBe(2)
    expect(result.captured.has('ok1')).toBe(true)
    expect(result.captured.has('ok2')).toBe(true)
    expect(result.failed).toEqual(['bad'])
  })

  it('capture returning null is treated as failure', async () => {
    exportPreviewService.register('nullish', async () => null)
    const ctrl = new AbortController()
    const result = await exportPreviewService.captureAll(['nullish'], ctrl.signal)
    expect(result.captured.size).toBe(0)
    expect(result.failed).toEqual(['nullish'])
  })

  it('per-widget timeout cancels the slow capture (returns null)', async () => {
    exportPreviewService.register('slow', (signal) =>
      new Promise((resolve) => {
        // Never resolves on its own. Resolves null only on abort.
        signal.addEventListener('abort', () => resolve(null), { once: true })
      }),
    )
    exportPreviewService.register('fast', async () => ({
      blob: new Blob(), width: 1, height: 1,
    }))

    const ctrl = new AbortController()
    const result = await exportPreviewService.captureAll(
      ['slow', 'fast'], ctrl.signal, { timeoutMs: 30 },
    )
    expect(result.captured.has('fast')).toBe(true)
    expect(result.failed).toContain('slow')
  })

  it('parallelism is bounded (≤ maxConcurrent at any time)', async () => {
    let active = 0
    let peak = 0
    const assetIds = Array.from({ length: 12 }, (_, i) => `a${i}`)

    for (const id of assetIds) {
      exportPreviewService.register(id, async (signal) => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 20))
        active--
        return { blob: new Blob(), width: 1, height: 1 }
      })
    }

    const ctrl = new AbortController()
    await exportPreviewService.captureAll(assetIds, ctrl.signal, { maxConcurrent: 3 })

    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(0)
  })

  it('abort propagates to in-flight captures (cancellation)', async () => {
    let aborted = false
    exportPreviewService.register('slow', (signal) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => {
          aborted = true
          resolve(null)
        }, { once: true })
      }),
    )
    const ctrl = new AbortController()
    const promise = exportPreviewService.captureAll(['slow'], ctrl.signal, { timeoutMs: 5_000 })
    // Trigger abort mid-flight
    setTimeout(() => ctrl.abort(), 10)
    await promise
    expect(aborted).toBe(true)
  })

  it('onProgress callback fires for each completed widget', async () => {
    const ids = ['x', 'y', 'z']
    for (const id of ids) {
      exportPreviewService.register(id, async () => ({
        blob: new Blob(), width: 1, height: 1,
      }))
    }
    const progress: Array<[number, number]> = []
    const ctrl = new AbortController()
    await exportPreviewService.captureAll(ids, ctrl.signal, {
      onProgress: (done, total) => progress.push([done, total]),
    })
    expect(progress.at(-1)).toEqual([3, 3])
    expect(progress.length).toBe(3)
  })

  it('caller never sees a thrown error from captureAll (INV-EP-3)', async () => {
    exportPreviewService.register('throws', async () => {
      throw new Error('synchronous throw inside async')
    })
    const ctrl = new AbortController()
    // Must NOT reject. If this test ever throws, INV-EP-3 is broken.
    await expect(
      exportPreviewService.captureAll(['throws'], ctrl.signal),
    ).resolves.toBeDefined()
  })

  it('empty assetIds returns immediately with empty result', async () => {
    const ctrl = new AbortController()
    const result = await exportPreviewService.captureAll([], ctrl.signal)
    expect(result.captured.size).toBe(0)
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
  })
})

describe('exportPreviewService — uploadAll', () => {
  beforeEach(() => {
    exportPreviewService._resetForTests()
    vi.mocked(winterboardApi.uploadExportPreview).mockReset()
  })

  it('uploads each captured preview, returns counters', async () => {
    vi.mocked(winterboardApi.uploadExportPreview).mockResolvedValue({
      id: 'prep-1',
      preview_url: '/x.png',
      expires_at: 'soon',
      reused: false,
    })
    const captures = new Map([
      ['a', { assetId: 'a', blob: new Blob(), width: 1, height: 1 }],
      ['b', { assetId: 'b', blob: new Blob(), width: 2, height: 2 }],
    ])
    const ctrl = new AbortController()
    const result = await exportPreviewService.uploadAll('sess-1', captures, ctrl.signal)
    expect(result.uploaded).toBe(2)
    expect(result.failed).toBe(0)
    expect(winterboardApi.uploadExportPreview).toHaveBeenCalledTimes(2)
  })

  it('counts reused responses', async () => {
    vi.mocked(winterboardApi.uploadExportPreview).mockResolvedValue({
      id: 'p', preview_url: '/x', expires_at: 's', reused: true,
    })
    const captures = new Map([
      ['a', { assetId: 'a', blob: new Blob(), width: 1, height: 1 }],
    ])
    const ctrl = new AbortController()
    const result = await exportPreviewService.uploadAll('sess', captures, ctrl.signal)
    expect(result.reused).toBe(1)
    expect(result.uploaded).toBe(1)
  })

  it('counts upload nulls as failures (silent INV-EP-3)', async () => {
    vi.mocked(winterboardApi.uploadExportPreview).mockResolvedValue(null)
    const captures = new Map([
      ['a', { assetId: 'a', blob: new Blob(), width: 1, height: 1 }],
    ])
    const ctrl = new AbortController()
    const result = await exportPreviewService.uploadAll('sess', captures, ctrl.signal)
    expect(result.failed).toBe(1)
    expect(result.uploaded).toBe(0)
  })

  it('empty captures returns zero counters', async () => {
    const ctrl = new AbortController()
    const result = await exportPreviewService.uploadAll('sess', new Map(), ctrl.signal)
    expect(result).toEqual({ uploaded: 0, failed: 0, reused: 0 })
  })
})
