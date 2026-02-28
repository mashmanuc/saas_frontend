import apiClient from '../utils/apiClient'

const PROFILE_AUTOSAVE = '/me/profile/autosave/'

/**
 * Fetch current user profile by combining /v1/me (user data) and /v1/me/settings.
 * Returns shape expected by profileStore.normalizeProfileResponse:
 *   { user, settings, avatar_url }
 */
export async function getMeProfile() {
  const [meData, settings] = await Promise.all([
    apiClient.get('/v1/me'),
    apiClient.get('/v1/me/settings').catch(() => null),
  ])
  const user = meData?.user ?? meData
  return {
    user,
    settings,
    avatar_url: user?.avatar_url ?? null,
  }
}

/**
 * Patch user profile fields via /v1/me.
 * Accepts: { first_name, last_name, timezone, username, phone, telegram_username }
 */
export async function patchMeProfile(payload) {
  const res = await apiClient.patch('/v1/me', payload)
  const user = res?.user ?? res
  return { user, avatar_url: user?.avatar_url ?? null }
}

export async function autosaveProfile(payload) {
  return apiClient.patch(PROFILE_AUTOSAVE, payload)
}

export async function fetchProfileDraft() {
  return apiClient.get(PROFILE_AUTOSAVE)
}

export async function discardProfileDraft() {
  return apiClient.delete(PROFILE_AUTOSAVE)
}

export async function updateAvatar(formData) {
  return apiClient.post('/me/avatar/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function deleteAvatar() {
  return apiClient.delete('/me/avatar/')
}
