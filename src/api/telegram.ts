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

// PR-FE-3 (2026-04-26): Removed double `/api/` prefix in all 4 endpoints.
// baseURL already includes /api, literal `/api/v1/...` produced `/api/api/v1/...` (404).
// BE routes verified: config/urls.py:58 mounts telegram_bot at `api/v1/telegram/`.

/** Backend: GET /api/v1/telegram/generate-link/ */
export async function generateTelegramLink(): Promise<TelegramLinkResponse> {
  // apiClient інтерцептор вже розгортає res.data, тому не деструктуризуємо
  const result = await apiClient.get('/v1/telegram/generate-link/')
  return result as TelegramLinkResponse
}

/** Backend: GET /api/v1/telegram/status/ */
export async function getTelegramStatus(): Promise<TelegramStatusResponse> {
  const result = await apiClient.get('/v1/telegram/status/')
  return result as TelegramStatusResponse
}

/** Backend: POST /api/v1/telegram/toggle/ */
export async function toggleTelegramNotifications(enabled: boolean): Promise<TelegramToggleResponse> {
  const result = await apiClient.post('/v1/telegram/toggle/', { enabled })
  return result as TelegramToggleResponse
}

/** Backend: POST /api/v1/telegram/disconnect/ */
export async function disconnectTelegram(): Promise<{ connected: boolean; enabled: boolean }> {
  const result = await apiClient.post('/v1/telegram/disconnect/')
  return result as { connected: boolean; enabled: boolean }
}
