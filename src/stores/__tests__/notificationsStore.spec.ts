import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationsStore } from '../notificationsStore'
import { notificationsApi } from '@/api/notifications'
import type { InAppNotification, NotificationPreferences } from '@/types/notifications'

vi.mock('@/api/notifications')

describe('notificationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadNotifications', () => {
    it('loads notifications successfully', async () => {
      const mockNotifications: InAppNotification[] = [
        {
          id: '1',
          type: 'lesson.created',
          title: 'New lesson',
          body: 'Lesson created',
          data: {},
          created_at: '2026-01-09T00:00:00Z',
          read_at: null,
        },
        {
          id: '2',
          type: 'inquiry.received',
          title: 'New inquiry',
          body: 'Inquiry received',
          data: {},
          created_at: '2026-01-08T00:00:00Z',
          read_at: '2026-01-08T01:00:00Z',
        },
      ]

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: mockNotifications,
        count: 2,
        next: null,
        previous: null,
      })

      const store = useNotificationsStore()
      await store.loadNotifications()

      expect(store.items).toEqual(mockNotifications)
      expect(store.unreadCount).toBe(1)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
    })

    it('handles load error', async () => {
      const error = new Error('Network error')
      vi.mocked(notificationsApi.getNotifications).mockRejectedValue(error)

      const store = useNotificationsStore()

      await store.loadNotifications()

      expect(store.error).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })

    it('filters unread notifications correctly', async () => {
      const mockNotifications: InAppNotification[] = [
        {
          id: '1',
          type: 'test',
          title: 'Unread',
          body: 'Body',
          data: {},
          created_at: '2026-01-09T00:00:00Z',
          read_at: null,
        },
        {
          id: '2',
          type: 'test',
          title: 'Read',
          body: 'Body',
          data: {},
          created_at: '2026-01-08T00:00:00Z',
          read_at: '2026-01-08T01:00:00Z',
        },
      ]

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: mockNotifications,
        count: 2,
        next: null,
        previous: null,
      })

      const store = useNotificationsStore()
      await store.loadNotifications()

      expect(store.unreadItems).toHaveLength(1)
      expect(store.unreadItems[0].id).toBe('1')
    })
  })

  describe('markAsRead', () => {
    it('marks notification as read with optimistic update', async () => {
      const notification: InAppNotification = {
        id: '1',
        type: 'test',
        title: 'Test',
        body: 'Body',
        data: {},
        created_at: '2026-01-09T00:00:00Z',
        read_at: null,
      }

      const updatedNotification = { ...notification, read_at: '2026-01-09T01:00:00Z' }

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: [notification],
        count: 1,
        next: null,
        previous: null,
      })

      vi.mocked(notificationsApi.markAsRead).mockResolvedValue(updatedNotification)

      const store = useNotificationsStore()
      await store.loadNotifications()

      expect(store.unreadCount).toBe(1)

      await store.markAsRead('1')

      expect(store.items[0].read_at).toBeTruthy()
      expect(store.unreadCount).toBe(0)
      expect(notificationsApi.markAsRead).toHaveBeenCalledWith('1')
    })

    it('reverts optimistic update on error', async () => {
      const notification: InAppNotification = {
        id: '1',
        type: 'test',
        title: 'Test',
        body: 'Body',
        data: {},
        created_at: '2026-01-09T00:00:00Z',
        read_at: null,
      }

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: [notification],
        count: 1,
        next: null,
        previous: null,
      })

      vi.mocked(notificationsApi.markAsRead).mockRejectedValue(new Error('API error'))

      const store = useNotificationsStore()
      await store.loadNotifications()

      const initialUnreadCount = store.unreadCount

      await expect(store.markAsRead('1')).rejects.toThrow()

      expect(store.items[0].read_at).toBe(null)
      expect(store.unreadCount).toBe(initialUnreadCount)
    })
  })

  describe('markAllAsRead', () => {
    it('marks all notifications as read with optimistic update', async () => {
      const mockNotifications: InAppNotification[] = [
        {
          id: '1',
          type: 'test',
          title: 'Test 1',
          body: 'Body',
          data: {},
          created_at: '2026-01-09T00:00:00Z',
          read_at: null,
        },
        {
          id: '2',
          type: 'test',
          title: 'Test 2',
          body: 'Body',
          data: {},
          created_at: '2026-01-08T00:00:00Z',
          read_at: null,
        },
      ]

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: mockNotifications,
        count: 2,
        next: null,
        previous: null,
      })

      vi.mocked(notificationsApi.markAllAsRead).mockResolvedValue({ marked_count: 2 })

      const store = useNotificationsStore()
      await store.loadNotifications()

      expect(store.unreadCount).toBe(2)

      await store.markAllAsRead()

      expect(store.items.every(n => n.read_at !== null)).toBe(true)
      expect(store.unreadCount).toBe(0)
      expect(notificationsApi.markAllAsRead).toHaveBeenCalled()
    })

    it('reverts all notifications on error', async () => {
      const mockNotifications: InAppNotification[] = [
        {
          id: '1',
          type: 'test',
          title: 'Test 1',
          body: 'Body',
          data: {},
          created_at: '2026-01-09T00:00:00Z',
          read_at: null,
        },
      ]

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: mockNotifications,
        count: 1,
        next: null,
        previous: null,
      })

      vi.mocked(notificationsApi.markAllAsRead).mockRejectedValue(new Error('API error'))

      const store = useNotificationsStore()
      await store.loadNotifications()

      const initialItems = JSON.parse(JSON.stringify(store.items))
      const initialUnreadCount = store.unreadCount

      await expect(store.markAllAsRead()).rejects.toThrow()

      expect(store.items).toEqual(initialItems)
      expect(store.unreadCount).toBe(initialUnreadCount)
    })
  })

  describe('pollUnreadCount', () => {
    it('updates unread count from API', async () => {
      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: [],
        count: 5,
        next: null,
        previous: null,
      })

      const store = useNotificationsStore()
      await store.pollUnreadCount()

      expect(store.unreadCount).toBe(5)
      expect(notificationsApi.getNotifications).toHaveBeenCalledWith({
        unreadOnly: true,
        limit: 1,
      })
    })

    it('handles polling errors silently', async () => {
      vi.mocked(notificationsApi.getNotifications).mockRejectedValue(new Error('Network error'))

      const store = useNotificationsStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await store.pollUnreadCount()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('preferences', () => {
    it('loads preferences successfully', async () => {
      const mockPreferences: NotificationPreferences = {
        email_notifications: true,
        in_app_notifications: true,
      }

      vi.mocked(notificationsApi.getPreferences).mockResolvedValue(mockPreferences)

      const store = useNotificationsStore()
      await store.loadPreferences()

      expect(store.preferences).toEqual(mockPreferences)
      expect(store.isLoadingPreferences).toBe(false)
      expect(store.preferencesError).toBe(null)
    })

    it('updates preferences with optimistic update', async () => {
      const initialPreferences: NotificationPreferences = {
        email_notifications: true,
        in_app_notifications: true,
      }

      const updatedPreferences: NotificationPreferences = {
        email_notifications: false,
        in_app_notifications: true,
      }

      vi.mocked(notificationsApi.getPreferences).mockResolvedValue(initialPreferences)
      vi.mocked(notificationsApi.updatePreferences).mockResolvedValue(updatedPreferences)

      const store = useNotificationsStore()
      await store.loadPreferences()

      await store.updatePreferences({ email_notifications: false })

      expect(store.preferences?.email_notifications).toBe(false)
      expect(notificationsApi.updatePreferences).toHaveBeenCalledWith({ email_notifications: false })
    })

    it('reverts preferences on update error', async () => {
      const initialPreferences: NotificationPreferences = {
        email_notifications: true,
        in_app_notifications: true,
      }

      vi.mocked(notificationsApi.getPreferences).mockResolvedValue(initialPreferences)
      vi.mocked(notificationsApi.updatePreferences).mockRejectedValue(new Error('API error'))

      const store = useNotificationsStore()
      await store.loadPreferences()

      await expect(store.updatePreferences({ email_notifications: false })).rejects.toThrow()

      expect(store.preferences).toEqual(initialPreferences)
    })
  })

  describe('computed properties', () => {
    it('latestItems returns first 10 items', async () => {
      const mockNotifications: InAppNotification[] = Array.from({ length: 15 }, (_, i) => ({
        id: String(i + 1),
        type: 'test',
        title: `Test ${i + 1}`,
        body: 'Body',
        data: {},
        created_at: '2026-01-09T00:00:00Z',
        read_at: null,
      }))

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: mockNotifications,
        count: 15,
        next: null,
        previous: null,
      })

      const store = useNotificationsStore()
      await store.loadNotifications()

      expect(store.latestItems).toHaveLength(10)
      expect(store.latestItems[0].id).toBe('1')
      expect(store.latestItems[9].id).toBe('10')
    })
  })

  describe('polling', () => {
    it('starts and stops polling', () => {
      vi.useFakeTimers()

      const store = useNotificationsStore()

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        results: [],
        count: 0,
        next: null,
        previous: null,
      })

      store.startPolling(1000)

      expect(notificationsApi.getNotifications).toHaveBeenCalledTimes(1)
      expect(notificationsApi.getNotifications).toHaveBeenLastCalledWith({ unreadOnly: true, limit: 1 })

      vi.advanceTimersByTime(1000)
      expect(notificationsApi.getNotifications).toHaveBeenCalledTimes(2)

      vi.advanceTimersByTime(1000)
      expect(notificationsApi.getNotifications).toHaveBeenCalledTimes(3)

      store.stopPolling()

      vi.advanceTimersByTime(1000)
      expect(notificationsApi.getNotifications).toHaveBeenCalledTimes(3)

      vi.useRealTimers()
    })
  })
})
