import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { LibraryAsset, LibraryFolderTree } from '../../types/library'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpdateAsset = vi.fn()
const mockShowToast = vi.fn()

vi.mock('../../api/library', () => ({
  updateAsset: (...args: any[]) => mockUpdateAsset(...args),
}))

vi.mock('../useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

import { useAssetMove, findFolderName } from '../useAssetMove'
import { buildBreadcrumb } from '../useMaterialsBrowser'
import { flattenFolderTree } from '../../utils/flattenFolderTree'
import { DRAG_MIME, setAssetDragData, getAssetDragData, isAssetDrag } from '../../utils/dragHelpers'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<LibraryAsset> = {}): LibraryAsset {
  return {
    id: 1,
    name: 'file.pdf',
    storage_key: 'k',
    cdn_url: '/cdn/1',
    thumbnail_url: '/t/1',
    content_type: 'application/pdf',
    size_bytes: 100,
    status: 'active',
    folder: 5,
    is_favorite: false,
    last_used_at: null,
    tags: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeTree(): LibraryFolderTree[] {
  return [
    {
      id: 10,
      name: 'Math',
      parent: null,
      children: [
        { id: 42, name: 'Algebra', parent: 10, children: [], assets_count: 3 },
        { id: 43, name: 'Geometry', parent: 10, children: [], assets_count: 2 },
      ],
      assets_count: 5,
    },
    {
      id: 20,
      name: 'Physics',
      parent: null,
      children: [],
      assets_count: 8,
    },
  ]
}

// ─── useAssetMove ────────────────────────────────────────────────────────────

describe('useAssetMove', () => {
  beforeEach(() => {
    mockUpdateAsset.mockReset()
    mockShowToast.mockReset()
    mockUpdateAsset.mockResolvedValue({})
  })

  it('removes asset from list immediately on move (optimistic)', async () => {
    const asset = makeAsset({ id: 1, folder: 5 })
    const assets = ref<LibraryAsset[]>([asset, makeAsset({ id: 2, folder: 5 })])
    const total = ref(2)
    const reloadFolders = vi.fn()

    const { moveAsset } = useAssetMove({
      assets,
      total,
      reloadFolders,
      folders: ref(makeTree()),
    })

    const promise = moveAsset(asset, 10)

    // Optimistic: asset removed before API resolves
    expect(assets.value).toHaveLength(1)
    expect(assets.value[0].id).toBe(2)
    expect(total.value).toBe(1)

    await promise
  })

  it('calls updateAsset with correct folder', async () => {
    const asset = makeAsset({ id: 7, folder: 5 })
    const assets = ref<LibraryAsset[]>([asset])

    const { moveAsset } = useAssetMove({
      assets,
      reloadFolders: vi.fn(),
      folders: ref([]),
    })

    await moveAsset(asset, 10)

    expect(mockUpdateAsset).toHaveBeenCalledWith(7, { folder: 10 })
  })

  it('does nothing when target === current folder (noop)', async () => {
    const asset = makeAsset({ id: 1, folder: 5 })
    const assets = ref<LibraryAsset[]>([asset])

    const { moveAsset } = useAssetMove({
      assets,
      reloadFolders: vi.fn(),
      folders: ref([]),
    })

    await moveAsset(asset, 5)

    expect(mockUpdateAsset).not.toHaveBeenCalled()
    expect(assets.value).toHaveLength(1)
  })

  it('re-inserts asset on API error (rollback)', async () => {
    mockUpdateAsset.mockRejectedValue(new Error('Network error'))

    const asset = makeAsset({ id: 1, folder: 5 })
    const assets = ref<LibraryAsset[]>([asset])
    const total = ref(1)

    const { moveAsset } = useAssetMove({
      assets,
      total,
      reloadFolders: vi.fn(),
      folders: ref([]),
    })

    await moveAsset(asset, 10)

    // Rolled back
    expect(assets.value).toHaveLength(1)
    expect(assets.value[0].id).toBe(1)
    expect(total.value).toBe(1)
    expect(mockShowToast).toHaveBeenCalledWith('winterboard.library.moveError', 'error')
  })

  it('calls reloadFolders after successful move', async () => {
    const asset = makeAsset({ id: 1, folder: 5 })
    const reloadFolders = vi.fn()

    const { moveAsset } = useAssetMove({
      assets: ref<LibraryAsset[]>([asset]),
      reloadFolders,
      folders: ref([]),
    })

    await moveAsset(asset, 10)

    expect(reloadFolders).toHaveBeenCalledOnce()
  })

  it('shows success toast after move', async () => {
    const asset = makeAsset({ id: 1, folder: 5 })
    const tree = makeTree()

    const { moveAsset } = useAssetMove({
      assets: ref<LibraryAsset[]>([asset]),
      reloadFolders: vi.fn(),
      folders: ref(tree),
    })

    await moveAsset(asset, 10)

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('winterboard.library.fileMovedTo'),
      'success',
    )
  })

  it('shows generic toast when moving to root (null)', async () => {
    const asset = makeAsset({ id: 1, folder: 5 })

    const { moveAsset } = useAssetMove({
      assets: ref<LibraryAsset[]>([asset]),
      reloadFolders: vi.fn(),
      folders: ref([]),
    })

    await moveAsset(asset, null)

    expect(mockShowToast).toHaveBeenCalledWith('winterboard.library.fileMoved', 'success')
  })
})

// ─── findFolderName ──────────────────────────────────────────────────────────

describe('findFolderName', () => {
  it('finds top-level folder name', () => {
    expect(findFolderName(makeTree(), 10)).toBe('Math')
  })

  it('finds nested folder name', () => {
    expect(findFolderName(makeTree(), 42)).toBe('Algebra')
  })

  it('returns "root" for null', () => {
    expect(findFolderName(makeTree(), null)).toBe('root')
  })

  it('returns "root" for unknown id', () => {
    expect(findFolderName(makeTree(), 999)).toBe('root')
  })
})

// ─── buildBreadcrumb ─────────────────────────────────────────────────────────

describe('buildBreadcrumb', () => {
  it('returns [root] for null selectedId', () => {
    const result = buildBreadcrumb(makeTree(), null, 'All files')
    expect(result).toEqual([{ id: null, name: 'All files' }])
  })

  it('returns full path for nested folder', () => {
    const result = buildBreadcrumb(makeTree(), 42, 'All')
    expect(result).toEqual([
      { id: null, name: 'All' },
      { id: 10, name: 'Math' },
      { id: 42, name: 'Algebra' },
    ])
  })

  it('returns [root] for FAVORITES_ID (-1)', () => {
    const result = buildBreadcrumb(makeTree(), -1, 'All')
    expect(result).toEqual([{ id: null, name: 'All' }])
  })

  it('returns [root] for RECENT_ID (-2)', () => {
    const result = buildBreadcrumb(makeTree(), -2, 'All')
    expect(result).toEqual([{ id: null, name: 'All' }])
  })

  it('returns path for top-level folder', () => {
    const result = buildBreadcrumb(makeTree(), 20, 'All')
    expect(result).toEqual([
      { id: null, name: 'All' },
      { id: 20, name: 'Physics' },
    ])
  })
})

// ─── flattenFolderTree ───────────────────────────────────────────────────────

describe('flattenFolderTree', () => {
  it('flattens nested tree with correct depths', () => {
    const result = flattenFolderTree(makeTree())
    expect(result).toEqual([
      { id: 10, name: 'Math', depth: 0 },
      { id: 42, name: 'Algebra', depth: 1 },
      { id: 43, name: 'Geometry', depth: 1 },
      { id: 20, name: 'Physics', depth: 0 },
    ])
  })

  it('returns empty array for empty tree', () => {
    expect(flattenFolderTree([])).toEqual([])
  })
})

// ─── dragHelpers ─────────────────────────────────────────────────────────────

describe('dragHelpers', () => {
  function makeDragEvent(data: Record<string, string> = {}): DragEvent {
    const types = Object.keys(data)
    return {
      dataTransfer: {
        setData: vi.fn((type: string, value: string) => { data[type] = value }),
        getData: vi.fn((type: string) => data[type] ?? ''),
        types,
        effectAllowed: 'uninitialized',
      },
    } as unknown as DragEvent
  }

  it('DRAG_MIME is a custom type', () => {
    expect(DRAG_MIME).toBe('application/x-asset-id')
  })

  it('setAssetDragData sets id and effectAllowed', () => {
    const e = makeDragEvent()
    setAssetDragData(e, 42)
    expect(e.dataTransfer!.setData).toHaveBeenCalledWith(DRAG_MIME, '42')
    expect(e.dataTransfer!.effectAllowed).toBe('move')
  })

  it('getAssetDragData parses valid id', () => {
    const e = makeDragEvent({ [DRAG_MIME]: '42' })
    expect(getAssetDragData(e)).toBe(42)
  })

  it('getAssetDragData returns null for invalid data', () => {
    const e = makeDragEvent({ [DRAG_MIME]: 'abc' })
    expect(getAssetDragData(e)).toBeNull()
  })

  it('getAssetDragData returns null for zero', () => {
    const e = makeDragEvent({ [DRAG_MIME]: '0' })
    expect(getAssetDragData(e)).toBeNull()
  })

  it('isAssetDrag returns true when DRAG_MIME present', () => {
    const e = makeDragEvent({ [DRAG_MIME]: '1' })
    // types includes the MIME
    expect(isAssetDrag(e)).toBe(true)
  })

  it('isAssetDrag returns false when DRAG_MIME absent', () => {
    const e = makeDragEvent({})
    expect(isAssetDrag(e)).toBe(false)
  })
})
