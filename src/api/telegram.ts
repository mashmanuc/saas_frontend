/**
 * Telegram Bot API client.
 * v2: Use server-side QR SVG (MFA pattern) - removes broken qrcode npm
 * SPEC: backend/docs/Plan_telegram/SPEC_TELEGRAM_NOTIFICATIONS.md §5
 */
import apiClient from '@/utils/apiClient'

export interface TelegramLinkResponse {
  deep_link: string
  qr_svg: string
  qr_data: string
  expires_at: string
  ttl_seconds: number
}

export interface TelegramStatusResponse {
  connected: boolean
  enabled: boolean
  connected_at: string | null
}

export interface TelegramToggleResponse {
  enabled: boolean
  connected: boolean
}

/** GET /api/v1/telegram/generate-link/ */
export async function generateTelegramLink(): Promise<TelegramLinkResponse> {
  const { data } = await apiClient.get('/api/v1/telegram/generate-link/')
  return data
}

/** GET /api/v1/telegram/status/ */
export async function getTelegramStatus(): Promise<TelegramStatusResponse> {
  const { data } = await apiClient.get('/api/v1/telegram/status/')
  return data
}

/** POST /api/v1/telegram/toggle/ */
export async function toggleTelegramNotifications(enabled: boolean): Promise<TelegramToggleResponse> {
  const { data } = await apiClient.post('/api/v1/telegram/toggle/', { enabled })
  return data
}

/** POST /api/v1/telegram/disconnect/ */
export async function disconnectTelegram(): Promise<{ connected: boolean; enabled: boolean }> {
  const { data } = await apiClient.post('/api/v1/telegram/disconnect/')
  return data
}
