import { defineStore } from 'pinia'
import {
  getMeProfile,
  patchMeProfile,
  autosaveProfile,
  fetchProfileDraft,
  discardProfileDraft,
  updateAvatar,
  deleteAvatar,
} from '../../../api/profile'
import { notifyError, notifySuccess } from '../../../utils/notify'
import { resolveMediaUrl } from '../../../utils/media'
import { i18n } from '../../../i18n'
import { useAuthStore } from '../../auth/store/authStore'

const translate = (key, params) => {
  try {
    return i18n.global?.t?.(key, params) ?? key
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('i18n translate failed for key:', key, error)
    }
    return key
  }
}

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
    draftLoading: false,
    error: null,
    lastSavedAt: null,
    lastAutosavedAt: null,
    hasUnsavedChanges: false,
    hasDraft: false,
    draftData: null,
    draftError: null,
    isRateLimited: false,
    rateLimitUntil: null,
    completenessScore: 0,
    emailVerified: false,
  }),
  getters: {
    fullName: (state) => {
      const user = state.user
      if (!user) return ''
      return [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    },
    role: (state) => state.user?.role || null,
    isTutor: (state) => state.user?.role === 'TUTOR',
    isStudent: (state) => state.user?.role === 'STUDENT',
    timezone: (state) => state.user?.timezone || state.settings?.timezone || 'UTC',
    profileDescription: (state) => state.profile?.bio || '',
    profileComplete: (state) => state.completenessScore >= 100,
    missingFields: (state) => {
      const fields = []
      if (!state.profile?.bio) fields.push('bio')
      if (!state.profile?.headline) fields.push('headline')
      if (!state.profile?.hourly_rate) fields.push('hourly_rate')
      if (!state.avatarUrl) fields.push('avatar')
      return fields
    },
  },
  actions: {
    setProfileState(data) {
      const normalized = normalizeProfileResponse(data)
      this.user = normalized.user
      this.profile = normalized.profile
      this.settings = normalized.settings
      this.avatarUrl = normalized.avatarUrl
      this.emailVerified = normalized.user?.email_verified || false
      this.initialized = true
      this.hasUnsavedChanges = false
      this.hasDraft = false
      this.draftData = null
      this.calculateCompleteness()
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
        this.error = error?.response?.data?.detail || translate('profile.messages.loadError')
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
        this.lastAutosavedAt = this.lastSavedAt
        this.hasUnsavedChanges = false
        
        // Telemetry: profile updated
        if (typeof window !== 'undefined' && window.telemetry) {
          window.telemetry.trackEvent('profile_updated', { 
            userId: this.user?.id,
            role: this.user?.role,
            completeness: this.completenessScore
          })
        }
        
        notifySuccess(translate('profile.messages.saveSuccess'))
        return data
      } catch (error) {
        this.error = error?.response?.data?.detail || translate('profile.messages.saveError')
        notifyError(this.error)
        throw error
      } finally {
        await this.discardProfileDraft().catch(() => {})
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
      
      // Telemetry: avatar upload started
      if (typeof window !== 'undefined' && window.telemetry) {
        window.telemetry.trackEvent('avatar_upload_started', { 
          userId: this.user?.id,
          fileSize: file.size 
        })
      }
      
      try {
        const data = await updateAvatar(formData)
        const avatarUrl = normalizeAvatarUrl(data?.avatar_url)
        this.avatarUrl = avatarUrl
        if (this.user) {
          this.user = { ...this.user, avatar_url: avatarUrl }
        }

        const auth = useAuthStore()
        if (auth.user) {
          auth.setAuth({ user: { ...auth.user, avatar_url: avatarUrl } })
        }
        
        // Telemetry: avatar upload success
        if (typeof window !== 'undefined' && window.telemetry) {
          window.telemetry.trackEvent('avatar_upload_success', { 
            userId: this.user?.id,
            fileSize: file.size 
          })
        }
        
        notifySuccess(translate('profile.messages.avatarUpdateSuccess'))
        return data
      } catch (error) {
        // Telemetry: avatar upload failed
        if (typeof window !== 'undefined' && window.telemetry) {
          window.telemetry.trackEvent('avatar_upload_failed', { 
            userId: this.user?.id,
            error: error?.message 
          })
        }
        
        notifyError(translate('profile.messages.avatarUpdateError'))
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

        const auth = useAuthStore()
        if (auth.user) {
          auth.setAuth({ user: { ...auth.user, avatar_url: null } })
        }
        notifySuccess(translate('profile.messages.avatarDeleteSuccess'))
      } catch (error) {
        notifyError(translate('profile.messages.avatarDeleteError'))
        throw error
      }
    },
    clearRateLimit() {
      this.isRateLimited = false
      this.rateLimitUntil = null
    },

    async autosaveDraft(payload) {
      if (!payload || this.saving) return
      if (this.isRateLimited && this.rateLimitUntil) {
        if (Date.now() >= this.rateLimitUntil) {
          this.clearRateLimit()
        } else {
          return { status: 'rate_limited' }
        }
      }

      try {
        const response = await autosaveProfile(payload)
        this.lastAutosavedAt = new Date()
        this.draftData = payload
        this.hasDraft = true
        this.hasUnsavedChanges = false
        this.clearRateLimit()
        return response
      } catch (error) {
        if (error?.response?.status === 429) {
          this.isRateLimited = true
          this.rateLimitUntil = Date.now() + 10_000
          return { status: 'rate_limited' }
        }
        this.error = error?.response?.data?.detail || translate('profile.autosave.error')
        throw error
      }
    },
    async loadProfileDraft() {
      this.draftLoading = true
      this.draftError = null
      try {
        const data = await fetchProfileDraft()
        if (data?.data && Object.keys(data.data).length) {
          this.draftData = data.data
          this.hasDraft = true
          if (data.autosaved_at) {
            this.lastAutosavedAt = new Date(data.autosaved_at)
          }
          return data
        }
        this.draftData = null
        this.hasDraft = false
        return null
      } catch (error) {
        if (error?.response?.status === 404) {
          this.draftData = null
          this.hasDraft = false
          return null
        }
        this.draftError = error?.response?.data?.detail || translate('profile.draft.error')
        throw error
      } finally {
        this.draftLoading = false
      }
    },
    async discardProfileDraft() {
      try {
        await discardProfileDraft()
      } catch (error) {
        this.draftError = error?.response?.data?.detail || translate('profile.draft.discardError')
        throw error
      } finally {
        this.draftData = null
        this.hasDraft = false
      }
    },
    calculateCompleteness() {
      if (!this.profile || this.user?.role !== 'TUTOR') {
        this.completenessScore = 0
        return
      }
      let score = 0
      if (this.profile.bio?.trim()) score += 20
      if (this.profile.headline?.trim()) score += 15
      if (this.profile.experience > 0) score += 10
      if (this.profile.hourly_rate > 0) score += 15
      if (this.profile.subjects?.length > 0) score += 20
      if (this.profile.certifications?.length > 0) score += 10
      if (this.avatarUrl) score += 10
      this.completenessScore = score
    },
    async updateSettings(settingsPayload) {
      if (!settingsPayload || typeof settingsPayload !== 'object') return
      this.saving = true
      try {
        const { updateUserSettings } = await import('../../../api/users')
        const data = await updateUserSettings(settingsPayload)
        if (this.settings) {
          this.settings = { ...this.settings, ...data }
        } else {
          this.settings = data
        }
        
        // Telemetry: settings updated
        if (typeof window !== 'undefined' && window.telemetry) {
          window.telemetry.trackEvent('settings_updated', { 
            userId: this.user?.id,
            changedFields: Object.keys(settingsPayload)
          })
        }
        
        notifySuccess(translate('users.settings.saveSuccess'))
        return data
      } catch (error) {
        notifyError(translate('users.settings.saveError'))
        throw error
      } finally {
        this.saving = false
      }
    },
    async resendVerification() {
      try {
        const { resendVerificationEmail } = await import('../../../api/users')
        await resendVerificationEmail()
        
        // Telemetry: email verification resent
        if (typeof window !== 'undefined' && window.telemetry) {
          window.telemetry.trackEvent('email_verification_resent', { 
            userId: this.user?.id
          })
        }
        
        notifySuccess(translate('users.verification.emailSent'))
      } catch (error) {
        notifyError(translate('users.verification.emailSendError'))
        throw error
      }
    },
  },
})
