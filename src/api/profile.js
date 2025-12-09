import apiClient from '../utils/apiClient'

const PROFILE_BASE = '/me/profile/'
const PROFILE_AUTOSAVE = `${PROFILE_BASE}autosave/`

export async function getMeProfile() {
  return apiClient.get(PROFILE_BASE)
}

export async function patchMeProfile(payload) {
  return apiClient.patch(PROFILE_BASE, payload)
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
