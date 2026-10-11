import api from '@/api/client'

export interface PlatformSetting {
  key: string
  label: string
  description: string
  category: string
  danger: boolean
  value: boolean
}

export interface SettingChange {
  key: string
  old_value: boolean
  new_value: boolean
}

const BASE = '/v1/staff/platform-settings'

/** Налаштування лендінгу в staff (2026-10-11: + відео блоку «Дзеркало» і його постер). */
export interface LandingConfigFields {
  replay_demo_url: string
  mirror_video_url: string
  mirror_video_poster_url: string
}

export default {
  async getAll(): Promise<PlatformSetting[]> {
    const { data } = await api.get(`${BASE}/`)
    return data
  },

  async update(changes: Record<string, boolean>): Promise<SettingChange[]> {
    const { data } = await api.patch(`${BASE}/`, changes)
    return data
  },

  // Landing config (реплей для демо-секції + відео Дзеркала) — окремий endpoint
  async getLandingConfig(): Promise<LandingConfigFields> {
    // apiClient-interceptor вже повертає тіло (res.data); BE віддає flat
    // {replay_demo_url, mirror_video_url, …} → повертаємо тіло як є (НЕ .data — його тут немає).
    const body: any = await api.get('/v1/staff/landing-config/')
    return body
  },

  /** Лише передані поля: поле, якого немає в запиті, сервер не чіпає. */
  async updateLandingConfig(patch: Partial<LandingConfigFields>): Promise<LandingConfigFields> {
    const body: any = await api.patch('/v1/staff/landing-config/', patch)
    return body
  },
}
