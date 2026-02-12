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
      notifications: [  // ⚠️ CONTRACT FIX: was 'results', now 'notifications'
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

  /**
   * 🎯 CRITICAL TEST #5: Realtime notification → unreadCount +1
   * 
   * Catches: store logic failure
   * If this fails → WS event arrives but UI doesn't update
   */
  it('increments unreadCount on realtime notification', () => {
    const store = useNotificationsStore()
    store.unreadCount = 0
    store.items = []

    // Act: Simulate WebSocket event
    store.handleRealtimeNotification({
      type: 'notification',
      payload: {
        id: 'ws-ntf-1',
        type: 'INQUIRY_CREATED',
        title: 'Новий запит',
        body: 'Студент надіслав запит',
        data: {},
        created_at: '2024-01-15T10:30:00.000Z',
      }
    })

    // Assert: unreadCount incremented
    expect(store.unreadCount).toBe(1)
    expect(store.items).toHaveLength(1)
    expect(store.items[0].id).toBe('ws-ntf-1')
    expect(store.items[0].read_at).toBeNull() // Realtime = always unread initially
  })

  /**
   * 🎯 CRITICAL TEST #6: Polling → unreadCount = backend truth (SSOT)
   * 
   * Catches: unreadCount out of sync with DB
   * 
   * Architecture invariant:
   *   Backend state (via polling) = source of truth
   *   WS = acceleration only
   */
  it('sets unreadCount from polling results (backend is SSOT)', async () => {
    const store = useNotificationsStore()
    store.currentUserId = 'user-1'
    
    // Arrange: Backend returns 2 unread notifications
    listMock.mockResolvedValueOnce({
      notifications: [  // ⚠️ CONTRACT FIX: was 'results', now 'notifications'
        {
          id: 'ntf-1',
          type: 'INQUIRY_CREATED',
          title: 'Новий запит 1',
          body: 'Body 1',
          data: {},
          created_at: '2024-01-15T10:00:00.000Z',
          read_at: null, // ← unread
        },
        {
          id: 'ntf-2',
          type: 'INQUIRY_ACCEPTED',
          title: 'Запит прийнято',
          body: 'Body 2',
          data: {},
          created_at: '2024-01-15T09:00:00.000Z',
          read_at: null, // ← unread
        },
        {
          id: 'ntf-3',
          type: 'SYSTEM',
          title: 'System message',
          body: 'Body 3',
          data: {},
          created_at: '2024-01-15T08:00:00.000Z',
          read_at: '2024-01-15T08:05:00.000Z', // ← read
        },
      ],
    })

    // Act: Load via polling (simulating loadNotifications call)
    await store.loadNotifications({ limit: 10 })

    // Assert: unreadCount = count of items with read_at=null
    expect(store.items).toHaveLength(3)
    expect(store.unreadCount).toBe(2) // Only ntf-1 and ntf-2 are unread
    
    // Verify invariant: unreadCount matches filter logic
    const expectedUnread = store.items.filter(n => !n.read_at).length
    expect(store.unreadCount).toBe(expectedUnread)
  })

  /**
   * 🧠 ARCHITECTURE INVARIANT (documented in test):
   * 
   * WebSocket ≠ source of truth
   * Polling + DB = source of truth  
   * WS only accelerates UI update
   * 
   * This means:
   * - If WS works: +1 appears instantly, then polling confirms
   * - If WS fails: +1 appears within 60s via polling
   * - unreadCount always eventually consistent with backend
   */
  it('maintains invariant: WS acceleration + polling SSOT', async () => {
    const store = useNotificationsStore()
    store.currentUserId = 'user-1'
    store.unreadCount = 0
    store.items = []

    // Step 1: WS event arrives (acceleration)
    store.handleRealtimeNotification({
      type: 'notification',
      payload: {
        id: 'realtime-ntf',
        type: 'TEST',
        title: 'Realtime',
        body: 'From WS',
        data: {},
        created_at: '2024-01-15T10:00:00.000Z',
      }
    })
    
    // Immediately after WS: +1 (optimistic)
    expect(store.unreadCount).toBe(1)
    
    // Step 2: Polling happens (SSOT sync)
    listMock.mockResolvedValueOnce({
      notifications: [  // ⚠️ CONTRACT FIX: was 'results', now 'notifications'
        {
          id: 'realtime-ntf',
          type: 'TEST',
          title: 'Realtime',
          body: 'From WS',
          data: {},
          created_at: '2024-01-15T10:00:00.000Z',
          read_at: null, // Confirmed unread in DB
        }
      ],
    })
    
    await store.loadNotifications({ limit: 10 })
    
    // After polling: still +1 (confirmed by backend)
    expect(store.unreadCount).toBe(1)
    
    // Step 3: Simulate "WS arrived but not saved" scenario
    // (rare edge case due to transaction.atomic + signal timing)
    listMock.mockResolvedValueOnce({
      notifications: [], // Backend doesn't have it yet
    })
    
    await store.loadNotifications({ limit: 10 })
    
    // After polling correction: 0 (backend is SSOT)
    expect(store.unreadCount).toBe(0)
    expect(store.items).toHaveLength(0)
  })
})
