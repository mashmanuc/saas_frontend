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
  cursor?: string | null
}

export interface NotificationsListResponse {
  results: InAppNotification[]
  count: number
  next: string | null
  previous: string | null
}
