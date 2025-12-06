import api from '../../../utils/apiClient'

const authApi = {
  login(payload) {
    return api.post('/auth/login/', payload)
  },

  register(payload) {
    return api.post('/auth/register/', payload)
  },

  refresh() {
    return api.post('/auth/refresh/')
  },

  logout() {
    return api.post('/auth/logout/')
  },

  getCurrentUser() {
    return api.get('/users/me/')
  },

  validateInvite(token) {
    return api.get('/auth/invite/validate/', {
      params: { token },
    })
  },

  acceptInvite(payload) {
    return api.post('/auth/invite/accept/', payload)
  },
}

export default authApi
