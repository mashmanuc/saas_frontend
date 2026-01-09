import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listMock = vi.fn()
const markReadMock = vi.fn()
const publishMock = vi.fn()
const subscribeMock = vi.fn(() => () => {})
const onMock = vi.fn()
const notifyInfoMock = vi.fn()

vi.mock('../../src/api/notifications', () => ({
  notificationsApi: {
    getNotifications: (...args) => listMock(...args),
    markAsRead: (...args) => markReadMock(...args),
  },
}))

vi.mock('../../src/services/realtime', () => ({
  realtimeService: {
    subscribe: (...args) => subscribeMock(...args),
    publish: (...args) => publishMock(...args),
    on: (...args) => onMock(...args),
  },
}))

vi.mock('../../src/utils/notify', () => ({
  notifyInfo: (...args) => notifyInfoMock(...args),
}))

vi.mock('../../src/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    access: 'token',
    $onAction: vi.fn(),
  }),
}))

const { useNotificationsStore } = await import('../../src/stores/notificationsStore')

describe('notifications store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads list of notifications', async () => {
    const store = useNotificationsStore()
    store.currentUserId = 'user-1'
    listMock.mockResolvedValueOnce({
      results: [
        {
          id: 'ntf-1',
          type: 'test',
          title: 'Title',
          body: 'Body',
          data: {},
          created_at: '2024-01-01T00:00:00.000Z',
          read_at: null,
        },
      ],
      count: 1,
      next: null,
      previous: null,
    })

    await store.fetchNotifications({ replace: true })

    expect(listMock).toHaveBeenCalledWith({ limit: 10 })
    expect(store.items).toHaveLength(1)
    expect(store.loading).toBe(false)
  })

  it('marks notification as read optimistically', async () => {
    const store = useNotificationsStore()
    store.currentUserId = 'user-1'
    store.items = [
      {
        id: 'ntf-1',
        type: 'test',
        title: 'Title',
        body: 'Body',
        data: {},
        created_at: '2024-01-01T00:00:00.000Z',
        read_at: null,
      },
    ]
    markReadMock.mockResolvedValueOnce({})

    await store.markAsRead('ntf-1')

    expect(markReadMock).toHaveBeenCalledWith('ntf-1')
    expect(store.items[0].read_at).toBeTruthy()
  })

  it('handles fetch errors (offline/500) gracefully', async () => {
    const store = useNotificationsStore()
    store.currentUserId = 'user-1'
    listMock.mockRejectedValueOnce(new Error('offline'))

    await store.fetchNotifications({ replace: true })

    expect(listMock).toHaveBeenCalled()
    expect(store.items).toHaveLength(0)
    expect(store.loading).toBe(false)
  })

  it('keeps notification unread when markRead fails', async () => {
    const store = useNotificationsStore()
    store.currentUserId = 'user-1'
    store.items = [
      {
        id: 'ntf-1',
        type: 'test',
        title: 'Title',
        body: 'Body',
        data: {},
        created_at: '2024-01-01T00:00:00.000Z',
        read_at: null,
      },
    ]
    markReadMock.mockRejectedValueOnce(new Error('500'))

    await expect(store.markAsRead('ntf-1')).rejects.toThrow()

    expect(markReadMock).toHaveBeenCalled()
    expect(store.items[0].read_at).toBeNull()
  })

  it('adds mock notification via push event', () => {
    const store = useNotificationsStore()
    store.addMockNotification({
      id: 'mock-1',
      title: 'Dev ping',
      payload: { tag: 'Dev' },
    })

    expect(store.items[0].id).toBe('mock-1')
    expect(store.items[0].payload.title).toBe('Dev ping')
  })
})
