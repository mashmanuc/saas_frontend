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
    return data.data
  },

  async update(changes: Record<string, boolean>): Promise<SettingChange[]> {
    const { data } = await api.patch(`${BASE}/`, changes)
    return data.data
  },
}
