import { defineStore } from 'pinia'
import authApi from '../../auth/api/authApi'
import { notifyError, notifySuccess } from '../../../utils/notify'
import { i18n } from '../../../i18n'
import { resolveMediaUrl } from '../../../utils/media'

const t = (key, params) => {
  try {
    return i18n.global?.t?.(key, params) ?? key
  } catch {
    return key
  }
}

const normalizeAvatarUrl = (value) => (value ? resolveMediaUrl(value) : null)

export const useMeStore = defineStore('me', {
  state: () => ({
    user: null,
    loading: false,
    saving: false,
    error: null,
  }),
  getters: {
    avatarUrl: (state) => normalizeAvatarUrl(state.user?.avatar_url),
    fullName: (state) => [state.user?.first_name, state.user?.last_name].filter(Boolean).join(' ').trim(),
  },
  actions: {
    async load() {
      if (this.loading) return
      this.loading = true
      this.error = null
      try {
        this.user = await authApi.getCurrentUser()
        return this.user
      } catch (err) {
        this.error = t('userProfile.account.loadError')
        notifyError(this.error)
        throw err
      } finally {
        this.loading = false
      }
    },

    async save(payload) {
      if (this.saving) return
      this.saving = true
      this.error = null
      try {
        const res = await authApi.updateMe(payload)
        this.user = res?.user || res
        notifySuccess(t('userProfile.account.saveSuccess'))
        return this.user
      } catch (err) {
        this.error = t('userProfile.account.saveError')
        notifyError(this.error)
        throw err
      } finally {
        this.saving = false
      }
    },

    async uploadAvatar(file) {
      if (!file) return
      const formData = new FormData()
      formData.append('avatar', file)
      try {
        const res = await authApi.uploadAvatar(formData)
        const avatarUrl = normalizeAvatarUrl(res?.avatar_url)
        this.user = { ...(this.user || {}), avatar_url: avatarUrl }
        notifySuccess(t('userProfile.account.avatarUpdated'))
      } catch (err) {
        notifyError(t('userProfile.account.avatarUpdateError'))
        throw err
      }
    },

    async deleteAvatar() {
      try {
        await authApi.deleteAvatar()
        this.user = { ...(this.user || {}), avatar_url: null }
        notifySuccess(t('userProfile.account.avatarDeleted'))
      } catch (err) {
        notifyError(t('userProfile.account.avatarDeleteError'))
        throw err
      }
    },
  },
})
