import apiClient from '../utils/apiClient'
import type {
  InAppNotification,
  NotificationPreferences,
  NotificationsListParams,
  NotificationsListResponse,
} from '../types/notifications'

export const notificationsApi = {
  async getNotifications(params?: NotificationsListParams): Promise<NotificationsListResponse> {
    const queryParams: Record<string, any> = {}
    
    if (params?.unreadOnly) {
      queryParams.unread = 'true'
    }
    if (params?.limit) {
      queryParams.limit = params.limit
    }
    if (params?.cursor) {
      queryParams.cursor = params.cursor
    }

    return apiClient.get('/notifications/me', { params: queryParams })
  },

  async markAsRead(id: string): Promise<InAppNotification> {
    if (!id) {
      throw new Error('Notification ID is required')
    }
    return apiClient.post(`/notifications/${id}/read`, {})
  },

  async markAllAsRead(): Promise<{ marked_count: number }> {
    return apiClient.post('/notifications/read-all', {})
  },

  async getPreferences(): Promise<NotificationPreferences> {
    return apiClient.get('/notifications/me/preferences')
  },

  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return apiClient.post('/notifications/me/preferences', preferences)
  },
}
