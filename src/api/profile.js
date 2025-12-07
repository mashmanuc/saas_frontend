import apiClient from '../utils/apiClient'

export async function getMeProfile() {
  return apiClient.get('/me/profile/')
}

export async function patchMeProfile(payload) {
  return apiClient.patch('/me/profile/', payload)
}

export async function updateAvatar(formData) {
  return apiClient.post('/me/avatar/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function deleteAvatar() {
  return apiClient.delete('/me/avatar/')
}
