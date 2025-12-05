import axios from 'axios'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useLoaderStore } from '../stores/loaderStore'
import { notifyError, notifyWarning } from './notify'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

const createRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

api.interceptors.request.use(
  (config) => {
    const store = useAuthStore()
    const loader = useLoaderStore()
    loader.start()

    config.headers = config.headers || {}

    if (store.access) {
      config.headers.Authorization = `Bearer ${store.access}`
    }

    if (!config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = createRequestId()
    }

    return config
  },
  (error) => {
    const loader = useLoaderStore()
    loader.stop()
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (res) => {
    const loader = useLoaderStore()
    loader.stop()
    return res.data
  },
  async (error) => {
    const loader = useLoaderStore()
    loader.stop()
    const store = useAuthStore()
    const original = error.config || {}

    // Network or CORS problems
    if (!error.response) {
      notifyError('Немає з’єднання з сервером. Перевірте мережу.')
      return Promise.reject(error)
    }

    const status = error.response.status
    const code = error.response.data?.code

    if (status === 401 && code === 'token_not_valid' && !original._retry) {
      original._retry = true

      try {
        const newAccess = await store.refreshAccess()
        if (!newAccess) throw new Error('refresh_failed')

        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (refreshError) {
        await store.forceLogout()
        notifyWarning('Сесію завершено. Увійдіть знову.')
        return Promise.reject(refreshError)
      }
    }

    if (status === 403) {
      notifyError('Доступ заборонено. Зверніться до адміністратора.')
    } else if (status >= 500) {
      notifyError('На сервері сталася помилка. Спробуйте пізніше.')
    }

    return Promise.reject(error)
  }
)

export default api
