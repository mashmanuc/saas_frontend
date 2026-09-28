/**
 * «Сценарій» §4.5: документ на дошці (PDF, docx, презентація — document_viewer) несе назву
 * матеріалу, як уже несуть аудіо й відео. Без неї пульт підписує документ лише видом
 * («Презентація 1»). Назву дає сервер у resolve-drop (`board_object.title`, BE c9cb2f59).
 *
 * Обидві гілки вставки документа: перетягування на полотно (`handleSidebarDrop`) і
 * `resolveAsset` (кидок на мініатюру сторінки) — одне правило.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { resolveDropMode } = vi.hoisted(() => ({ resolveDropMode: vi.fn() }))

vi.mock('@/modules/learning-content', () => ({
  learningContentApi: {
    resolveDropMode, getItemDetail: vi.fn(), getBySlug: vi.fn(),
    // облік матеріалу після вставки (trackMaterial) — звичайний шлях, без помилки в журналі
    createLessonMaterial: vi.fn().mockResolvedValue({}),
  },
  renderContentToSvgDataUrl: vi.fn(),
}))

import { useContentDrop } from '../composables/useContentDrop'
import type { WBAsset } from '../types/winterboard'

function docResponse(title?: string, contentType = 'presentation') {
  return {
    drop_mode: 'render_image',
    board_object: {
      type: 'document_viewer',
      src: 'http://slide1.png',
      currentPage: 0,
      totalPages: 12,
      viewerMode: 'compact',
      content_ref: { content_id: 77, content_version: 1, content_type: contentType },
      ...(title !== undefined ? { title } : {}),
    },
  }
}

function makeDrop() {
  const onAssetAdd = vi.fn()
  const drop = useContentDrop({
    sessionId: ref('s-1'),
    canDraw: ref(true),
    onAssetAdd,
    screenToCanvas: (x, y) => ({ x, y }),
  })
  return { ...drop, onAssetAdd }
}

const payload = { content_item_id: 77, asset_category: 'presentation', content_type: 'presentation' }

beforeEach(() => { resolveDropMode.mockReset() })

describe('document_viewer отримує назву матеріалу', () => {
  it('перетягування на полотно: назва з board_object.title', async () => {
    resolveDropMode.mockResolvedValue(docResponse('Проєкт 7-Б'))
    const { handleSidebarDrop, onAssetAdd } = makeDrop()
    await handleSidebarDrop(payload, { x: 300, y: 200 })
    const asset = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(asset.type).toBe('document_viewer')
    expect(asset.title).toBe('Проєкт 7-Б')
  })

  it('resolveAsset (кидок на мініатюру): те саме правило', async () => {
    resolveDropMode.mockResolvedValue(docResponse('Умова задачі', 'pdf'))
    const { resolveAsset } = makeDrop()
    const asset = await resolveAsset(payload)
    expect(asset?.type).toBe('document_viewer')
    expect(asset?.title).toBe('Умова задачі')
  })

  it('старий сервер без назви або порожня назва — поля немає (пульт підпише за видом)', async () => {
    for (const title of [undefined, '']) {
      resolveDropMode.mockResolvedValue(docResponse(title))
      const { handleSidebarDrop, onAssetAdd } = makeDrop()
      await handleSidebarDrop(payload, { x: 0, y: 0 })
      expect((onAssetAdd.mock.calls[0][0] as WBAsset).title, String(title)).toBeUndefined()
      const asset = await makeDrop().resolveAsset(payload)
      expect(asset?.title, String(title)).toBeUndefined()
    }
  })
})
