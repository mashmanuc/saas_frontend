import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRelationsStore } from '../../src/stores/relationsStore'

vi.mock('../../src/i18n', () => ({
  i18n: {
    global: {
      t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    },
  },
}))

vi.mock('../../src/api/relations', () => {
  const apiMock = {
    getStudentRelations: vi.fn(),
    getTutorRelations: vi.fn(),
    bulkAcceptTutorRelations: vi.fn(),
    bulkArchiveTutorRelations: vi.fn(),
    acceptRelation: vi.fn(),
    declineRelation: vi.fn(),
    resendRelation: vi.fn(),
  }
  return { default: apiMock }
})

vi.mock('../../src/utils/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  notifyInfo: vi.fn(),
}))

import relationsApi from '../../src/api/relations'
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from '../../src/utils/notify'

const baseRelationsResponse = {
  results: [
    { id: 1, status: 'invited', student: { id: 11 } },
    { id: 2, status: 'active', student: { id: 22 } },
  ],
  cursor: 'cursor-1',
  has_more: true,
  summary: { total: 2, invited: 1, active: 1, archived: 0 },
}

describe('relationsStore (tutor relations v3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchTutorRelations stores cursor, summary and replaces list', async () => {
    relationsApi.getTutorRelations.mockResolvedValueOnce(baseRelationsResponse)
    const store = useRelationsStore()

    await store.fetchTutorRelations()

    expect(relationsApi.getTutorRelations).toHaveBeenCalledWith({ status: 'all' })
    expect(store.tutorRelations).toHaveLength(2)
    expect(store.tutorCursor).toBe('cursor-1')
    expect(store.tutorHasMore).toBe(true)
    expect(store.tutorSummary?.invited).toBe(1)
    expect(store.tutorLoading).toBe(false)
  })

  it('appends tutor relations when loadMore is triggered', async () => {
    relationsApi.getTutorRelations
      .mockResolvedValueOnce(baseRelationsResponse)
      .mockResolvedValueOnce({
        results: [{ id: 3, status: 'archived', student: { id: 33 } }],
        cursor: null,
        has_more: false,
        summary: { total: 3, invited: 1, active: 1, archived: 1 },
      })

    const store = useRelationsStore()
    await store.fetchTutorRelations()

    expect(store.tutorRelations).toHaveLength(2)

    await store.loadMoreTutorRelations()

    expect(relationsApi.getTutorRelations).toHaveBeenLastCalledWith({ status: 'all', cursor: 'cursor-1' })
    expect(store.tutorRelations).toHaveLength(3)
    expect(store.tutorRelations.at(-1)?.id).toBe(3)
    expect(store.tutorHasMore).toBe(false)
  })

  it('setTutorFilter resets cursor, selection and refetches data', async () => {
    relationsApi.getTutorRelations.mockResolvedValue(baseRelationsResponse)
    const store = useRelationsStore()

    await store.fetchTutorRelations()
    store.toggleTutorSelection(1)
    expect(store.tutorSelectedIds).toContain(1)

    await store.setTutorFilter('invited')

    expect(store.tutorFilter).toBe('invited')
    expect(store.tutorSelectedIds).toHaveLength(0)
    expect(store.tutorCursor).toBe('cursor-1')
    expect(relationsApi.getTutorRelations).toHaveBeenLastCalledWith({ status: 'invited' })
  })

  it('selection helpers toggle, select all and prune ids', async () => {
    relationsApi.getTutorRelations.mockResolvedValueOnce(baseRelationsResponse)
    const store = useRelationsStore()
    await store.fetchTutorRelations()

    store.toggleTutorSelection(1)
    expect(store.isTutorSelected(1)).toBe(true)
    store.toggleTutorSelection(1)
    expect(store.isTutorSelected(1)).toBe(false)

    store.selectAllCurrentTutorRelations()
    expect(store.tutorSelectedIds).toEqual([1, 2])

    // remove one relation from list to ensure prune removes unknown ids
    store.tutorRelations = store.tutorRelations.filter((relation) => relation.id !== 2)
    store.pruneTutorSelection()
    expect(store.tutorSelectedIds).toEqual([1])

    store.clearTutorSelection()
    expect(store.tutorSelectedIds).toHaveLength(0)
  })

  it('bulkAcceptSelectedTutorRelations sends only invited ids and refreshes data', async () => {
    relationsApi.getTutorRelations.mockResolvedValue(baseRelationsResponse)
    relationsApi.getStudentRelations.mockResolvedValue({ results: [] })
    relationsApi.bulkAcceptTutorRelations.mockResolvedValue({ processed: [1], failed: [] })

    const store = useRelationsStore()
    await store.fetchTutorRelations()
    store.tutorSelectedIds = [1, 2]

    await store.bulkAcceptSelectedTutorRelations()

    expect(relationsApi.bulkAcceptTutorRelations).toHaveBeenCalledWith([1])
    expect(notifySuccess).toHaveBeenCalled()
    expect(store.tutorSelectedIds).toHaveLength(0)
    expect(store.tutorBulkLoading).toBe(false)
    expect(relationsApi.getTutorRelations).toHaveBeenCalledTimes(2)
    expect(relationsApi.getStudentRelations).toHaveBeenCalledTimes(1)
  })

  it('bulkAcceptSelectedTutorRelations warns when no invited relations selected', async () => {
    relationsApi.getTutorRelations.mockResolvedValueOnce({
      ...baseRelationsResponse,
      results: [{ id: 2, status: 'active', student: { id: 22 } }],
    })
    const store = useRelationsStore()
    await store.fetchTutorRelations()

    store.tutorSelectedIds = [2]
    await store.bulkAcceptSelectedTutorRelations()

    expect(notifyWarning).toHaveBeenCalledWith('relations.bulk.noInvited')
    expect(relationsApi.bulkAcceptTutorRelations).not.toHaveBeenCalled()
  })

  it('bulkArchiveSelectedTutorRelations warns when nothing selected', async () => {
    const store = useRelationsStore()
    await store.bulkArchiveSelectedTutorRelations()

    expect(notifyWarning).toHaveBeenCalledWith('relations.bulk.emptySelection')
    expect(relationsApi.bulkArchiveTutorRelations).not.toHaveBeenCalled()
  })

  it('bulkArchiveSelectedTutorRelations posts ids and refreshes list', async () => {
    relationsApi.getTutorRelations.mockResolvedValue(baseRelationsResponse)
    relationsApi.bulkArchiveTutorRelations.mockResolvedValue({ processed: [2], failed: [3] })

    const store = useRelationsStore()
    await store.fetchTutorRelations()
    store.tutorSelectedIds = [2]

    await store.bulkArchiveSelectedTutorRelations()

    expect(relationsApi.bulkArchiveTutorRelations).toHaveBeenCalledWith([2])
    expect(notifySuccess).toHaveBeenCalled()
    expect(notifyWarning).toHaveBeenCalledWith(expect.stringContaining('relations.bulk.partialFailure'))
    expect(store.tutorSelectedIds).toHaveLength(0)
  })

  it('handleBulkResult emits correct notifications for outcomes', () => {
    const store = useRelationsStore()

    store.handleBulkResult('accept', { processed: [1], failed: [] })
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('relations.bulk.acceptSuccess'))

    store.handleBulkResult('archive', { processed: [], failed: [3, 4] })
    expect(notifyWarning).toHaveBeenCalledWith(expect.stringContaining('relations.bulk.partialFailure'))

    store.handleBulkResult('accept', { processed: [], failed: [] })
    expect(notifyInfo).toHaveBeenCalledWith('relations.bulk.noChanges')
  })

  it('fetchTutorRelations sets tutorError when request fails', async () => {
    relationsApi.getTutorRelations.mockRejectedValueOnce({
      response: { data: { detail: 'Server down' } },
    })
    const store = useRelationsStore()

    await expect(store.fetchTutorRelations()).rejects.toBeDefined()
    expect(store.tutorError).toBe('Server down')
  })

  it('fetchTutorRelations marks offline error when response missing', async () => {
    relationsApi.getTutorRelations.mockRejectedValueOnce(new Error('Network down'))
    const store = useRelationsStore()

    await expect(store.fetchTutorRelations()).rejects.toBeDefined()
    expect(store.tutorErrorCode).toBe('offline')
    expect(store.tutorError).toBe('relations.errors.offline')
  })

  it('fetchTutorRelations marks rate-limit errors', async () => {
    relationsApi.getTutorRelations.mockRejectedValueOnce({
      response: { status: 429 },
    })
    const store = useRelationsStore()

    await expect(store.fetchTutorRelations()).rejects.toBeDefined()
    expect(store.tutorErrorCode).toBe('rate-limit')
    expect(store.tutorError).toBe('relations.errors.rateLimit')
  })

  it('fetchTutorRelations handles empty states without crashing', async () => {
    relationsApi.getTutorRelations.mockResolvedValueOnce({
      results: [],
      cursor: null,
      has_more: false,
      summary: { total: 0, invited: 0, active: 0, archived: 0 },
    })
    const store = useRelationsStore()

    await store.fetchTutorRelations()

    expect(store.tutorRelations).toHaveLength(0)
    expect(store.tutorHasMore).toBe(false)
    expect(store.tutorSummary?.total).toBe(0)
  })

  it('loadMoreTutorRelations does nothing when hasMore flag is false', async () => {
    const store = useRelationsStore()
    store.tutorHasMore = false
    store.tutorCursor = null

    await store.loadMoreTutorRelations()

    expect(relationsApi.getTutorRelations).not.toHaveBeenCalled()
  })

  it('supports invited → active → archived transitions via filter', async () => {
    relationsApi.getTutorRelations
      .mockResolvedValueOnce({
        ...baseRelationsResponse,
        results: [{ id: 10, status: 'invited', student: { id: 100 } }],
      })
      .mockResolvedValueOnce({
        ...baseRelationsResponse,
        results: [{ id: 20, status: 'active', student: { id: 200 } }],
      })
      .mockResolvedValueOnce({
        ...baseRelationsResponse,
        results: [{ id: 30, status: 'archived', student: { id: 300 } }],
      })

    const store = useRelationsStore()

    await store.fetchTutorRelations()
    expect(store.tutorRelations[0]?.status).toBe('invited')

    await store.setTutorFilter('active')
    expect(store.tutorRelations[0]?.status).toBe('active')

    await store.setTutorFilter('archived')
    expect(store.tutorRelations[0]?.status).toBe('archived')
  })
})
