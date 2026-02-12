export interface InAppNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, any>
  created_at: string
  read_at: string | null
}

export interface NotificationPreferences {
  email_notifications: boolean
  in_app_notifications: boolean
}

export interface NotificationsListParams {
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

export interface NotificationsListResponse {
  notifications: InAppNotification[]
  total?: number
  limit?: number
  offset?: number
  has_more?: boolean
}

/**
 * Realtime WebSocket notification event payload
 * Matches backend NotificationEvent format
 */
export interface RealtimeNotificationEvent {
  type: 'notification'
  payload: {
    id: string
    type: string
    title: string
    body: string
    data: Record<string, any>
    created_at: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  }
}
