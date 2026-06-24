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

export default {
  async getAll(): Promise<PlatformSetting[]> {
    const { data } = await api.get(`${BASE}/`)
    return data
  },

  async update(changes: Record<string, boolean>): Promise<SettingChange[]> {
    const { data } = await api.patch(`${BASE}/`, changes)
    return data
  },

  // Landing config (реплей для демо-секції лендінгу) — окремий endpoint
  async getLandingConfig(): Promise<{ replay_demo_url: string }> {
    // apiClient-interceptor вже повертає тіло (res.data); BE віддає flat
    // {replay_demo_url} → повертаємо тіло як є (НЕ .data — його тут немає).
    const body: any = await api.get('/v1/staff/landing-config/')
    return body
  },

  async updateLandingConfig(replayDemoUrl: string): Promise<{ replay_demo_url: string }> {
    const body: any = await api.patch('/v1/staff/landing-config/', { replay_demo_url: replayDemoUrl })
    return body
  },
}
