// Phase 14 A3.5: Unit tests for templateApi
// Tests: all API methods, filter params, error handling

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock apiClient ──────────────────────────────────────────────────────────

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

// ── Mock global fetch for public pack endpoint ──────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Import after mocks ─────────────────────────────────────────────────────

import { templateApi } from '../api/templateApi'

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockTemplate = {
  id: 'tmpl-1',
  source_lesson_title: 'Test',
  source_lesson_slug: 'test',
  tutor_name: 'Ivan',
  tutor_slug: 'ivan',
  tutor_avatar_url: null,
  is_community: true,
  used_count: 5,
  subject_tag: 'math',
  difficulty_level: 3,
  board_thumbnail_url: null,
  created_at: '2026-03-16T10:00:00Z',
}

const mockListResponse = {
  templates: [mockTemplate],
  next_cursor: 2,
  total_count: 10,
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('templateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTemplates', () => {
    it('calls GET without params when no filters', async () => {
      mockGet.mockResolvedValue(mockListResponse)
      const res = await templateApi.getTemplates()
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/library/')
      expect(res).toEqual(mockListResponse)
    })

    it('builds query string from filters', async () => {
      mockGet.mockResolvedValue(mockListResponse)
      await templateApi.getTemplates({
        subject: 'math',
        difficulty_min: 2,
        difficulty_max: 4,
        sort: 'popular',
        cursor: 5,
      })
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/knowledge/lesson-templates/library/?subject=math&difficulty_min=2&difficulty_max=4&sort=popular&cursor=5',
      )
    })

    it('omits undefined filter values', async () => {
      mockGet.mockResolvedValue(mockListResponse)
      await templateApi.getTemplates({ sort: 'newest' })
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/library/?sort=newest')
    })
  })

  describe('getTemplateDetail', () => {
    it('calls GET with encoded id', async () => {
      const detail = { ...mockTemplate, description: 'desc', markers: [], snapshot_url: 'https://s3/snap' }
      mockGet.mockResolvedValue(detail)
      const res = await templateApi.getTemplateDetail('tmpl-1')
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/tmpl-1/')
      expect(res).toEqual(detail)
    })
  })

  describe('saveAsTemplate', () => {
    it('POSTs with payload', async () => {
      mockPost.mockResolvedValue(mockTemplate)
      const payload = { lesson_id: 'l-1', is_community: true, difficulty_level: 3 }
      const res = await templateApi.saveAsTemplate(payload)
      expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/', payload)
      expect(res).toEqual(mockTemplate)
    })
  })

  describe('cloneTemplate', () => {
    it('POSTs to clone endpoint', async () => {
      const cloneResult = { session_id: 's-1', session_name: 'From template' }
      mockPost.mockResolvedValue(cloneResult)
      const res = await templateApi.cloneTemplate('tmpl-1')
      expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/tmpl-1/clone/')
      expect(res).toEqual(cloneResult)
    })
  })

  describe('forkLesson', () => {
    it('POSTs to fork endpoint', async () => {
      const forkResult = { id: 'l-2', title: 'Forked', slug: 'forked', tutor_slug: 'ivan' }
      mockPost.mockResolvedValue(forkResult)
      const res = await templateApi.forkLesson('l-1')
      expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/my-lessons/l-1/fork/')
      expect(res).toEqual(forkResult)
    })
  })

  describe('getLessonForks', () => {
    it('GETs forks for a lesson', async () => {
      const forksData = { fork_count: 2, forks: [] }
      mockGet.mockResolvedValue(forksData)
      const res = await templateApi.getLessonForks('l-1')
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/my-lessons/l-1/forks/')
      expect(res).toEqual(forksData)
    })
  })

  describe('getMyPacks', () => {
    it('GETs packs list', async () => {
      const packsList = [{ id: 'p-1', title: 'Pack 1' }]
      mockGet.mockResolvedValue(packsList)
      const res = await templateApi.getMyPacks()
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/packs/')
      expect(res).toEqual(packsList)
    })
  })

  describe('createPack', () => {
    it('POSTs pack data', async () => {
      const pack = { id: 'p-1', title: 'New Pack' }
      mockPost.mockResolvedValue(pack)
      const payload = { title: 'New Pack', lesson_ids: ['l-1'], status: 'draft' as const }
      const res = await templateApi.createPack(payload)
      expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/packs/', payload)
      expect(res).toEqual(pack)
    })
  })

  describe('updatePack', () => {
    it('PATCHes pack data', async () => {
      const updated = { id: 'p-1', title: 'Updated' }
      mockPatch.mockResolvedValue(updated)
      const res = await templateApi.updatePack('p-1', { title: 'Updated' })
      expect(mockPatch).toHaveBeenCalledWith('/v1/knowledge/packs/p-1/', { title: 'Updated' })
      expect(res).toEqual(updated)
    })
  })

  describe('deletePack', () => {
    it('DELETEs pack', async () => {
      mockDelete.mockResolvedValue(undefined)
      await templateApi.deletePack('p-1')
      expect(mockDelete).toHaveBeenCalledWith('/v1/knowledge/packs/p-1/')
    })
  })

  describe('getPublicPack', () => {
    it('fetches public pack with correct URL', async () => {
      const packDetail = { id: 'p-1', title: 'Public Pack', items: [] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(packDetail),
      })
      const res = await templateApi.getPublicPack('ivan', 'my-pack')
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/public/packs/ivan/my-pack/')
      expect(res).toEqual(packDetail)
    })

    it('throws on non-OK response with status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })
      await expect(templateApi.getPublicPack('ivan', 'missing')).rejects.toThrow('404')
    })

    it('encodes special characters in slugs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
      await templateApi.getPublicPack('іван петренко', 'мій-пак')
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain(encodeURIComponent('іван петренко'))
      expect(calledUrl).toContain(encodeURIComponent('мій-пак'))
    })
  })
})
