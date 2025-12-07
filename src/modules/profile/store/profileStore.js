import { defineStore } from 'pinia'
import { getMeProfile, patchMeProfile, updateAvatar, deleteAvatar } from '../../../api/profile'
import { notifyError, notifySuccess } from '../../../utils/notify'
import { resolveMediaUrl } from '../../../utils/media'

function normalizeAvatarUrl(value) {
  if (!value) return null
  return resolveMediaUrl(value)
}

function normalizeProfileResponse(payload) {
  if (!payload || typeof payload !== 'object') return { user: null, profile: null, settings: null, avatarUrl: null }

  const {
    user = null,
    profile = null,
    tutor_profile: tutorProfile = null,
    student_profile: studentProfile = null,
    settings = null,
    avatar_url: avatarUrl = null,
  } = payload

  let resolvedProfile = profile
  if (!resolvedProfile) {
    resolvedProfile = tutorProfile || studentProfile || null
  }

  return {
    user,
    profile: resolvedProfile,
    settings,
    avatarUrl: normalizeAvatarUrl(avatarUrl || resolvedProfile?.avatar_url || user?.avatar_url),
    raw: payload,
  }
}

export const useProfileStore = defineStore('profile', {
  state: () => ({
    user: null,
    profile: null,
    settings: null,
    avatarUrl: null,
    initialized: false,
    loading: false,
    saving: false,
    error: null,
    lastSavedAt: null,
  }),
  getters: {
    fullName: (state) => {
      const user = state.user
      if (!user) return ''
      return [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    },
    role: (state) => state.user?.role || null,
    timezone: (state) => state.user?.timezone || state.settings?.timezone || 'UTC',
    profileDescription: (state) => state.profile?.bio || '',
  },
  actions: {
    setProfileState(data) {
      const normalized = normalizeProfileResponse(data)
      this.user = normalized.user
      this.profile = normalized.profile
      this.settings = normalized.settings
      this.avatarUrl = normalized.avatarUrl
      this.initialized = true
      return normalized.raw || normalized
    },
    async loadProfile() {
      this.loading = true
      this.error = null
      try {
        const data = await getMeProfile()
        this.setProfileState(data)
        return data
      } catch (error) {
        this.error = error?.response?.data?.detail || 'Не вдалося завантажити профіль'
        notifyError(this.error)
        throw error
      } finally {
        this.loading = false
      }
    },
    async saveProfile(payload) {
      if (this.saving) return
      this.saving = true
      this.error = null
      try {
        const data = await patchMeProfile(payload)
        this.setProfileState(data)
        this.lastSavedAt = new Date()
        notifySuccess('Зміни збережено')
        return data
      } catch (error) {
        this.error = error?.response?.data?.detail || 'Не вдалося зберегти зміни'
        notifyError(this.error)
        throw error
      } finally {
        this.saving = false
      }
    },
    async updateSettings(settingsPayload) {
      if (!settingsPayload || typeof settingsPayload !== 'object') return
      return this.saveProfile({ settings: settingsPayload })
    },
    async uploadAvatar(file) {
      if (!file) return
      const formData = new FormData()
      formData.append('avatar', file)
      try {
        const data = await updateAvatar(formData)
        const avatarUrl = normalizeAvatarUrl(data?.avatar_url)
        this.avatarUrl = avatarUrl
        if (this.user) {
          this.user = { ...this.user, avatar_url: avatarUrl }
        }
        notifySuccess('Аватар оновлено')
        return data
      } catch (error) {
        notifyError('Не вдалося оновити аватар')
        throw error
      }
    },
    async removeAvatar() {
      try {
        await deleteAvatar()
        this.avatarUrl = null
        if (this.user) {
          this.user = { ...this.user, avatar_url: null }
        }
        notifySuccess('Аватар видалено')
      } catch (error) {
        notifyError('Не вдалося видалити аватар')
        throw error
      }
    },
  },
})
