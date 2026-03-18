const hasWindow = typeof window !== 'undefined'

const ACCESS_KEY = 'access'
const REFRESH_KEY = 'refresh'
const USER_KEY = 'user'

const safeSet = (key, value) => {
  if (!hasWindow) return
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key)
  } else {
    window.localStorage.setItem(key, value)
  }
}

const safeGet = (key) => {
  if (!hasWindow) return null
  return window.localStorage.getItem(key)
}

const safeRemove = (key) => {
  if (!hasWindow) return
  window.localStorage.removeItem(key)
}

// Phase 2: One-time migration — clean legacy sensitive data from localStorage
;(function migrateStorage() {
  if (!hasWindow) return
  // Remove legacy access/refresh tokens (now in httpOnly cookies)
  if (window.localStorage.getItem(ACCESS_KEY)) {
    window.localStorage.removeItem(ACCESS_KEY)
  }
  if (window.localStorage.getItem(REFRESH_KEY)) {
    window.localStorage.removeItem(REFRESH_KEY)
  }
  // Re-serialize user data with minimal fields (strip email, phone, etc.)
  const rawUser = window.localStorage.getItem(USER_KEY)
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser)
      if (parsed && (parsed.email || parsed.phone || parsed.first_name)) {
        const minimal = {
          id: parsed.id,
          role: parsed.role,
          display_name: parsed.display_name || parsed.first_name || null,
        }
        window.localStorage.setItem(USER_KEY, JSON.stringify(minimal))
      }
    } catch { /* ignore parse errors */ }
  }
})()

export const storage = {
  // Generic key-value (Phase 1.3: auth_session marker)
  get(key) {
    return safeGet(key)
  },
  set(key, value) {
    safeSet(key, value)
  },
  remove(key) {
    safeRemove(key)
  },

  setAccess(token) {
    safeSet(ACCESS_KEY, token)
  },
  getAccess() {
    return safeGet(ACCESS_KEY)
  },
  removeAccess() {
    safeRemove(ACCESS_KEY)
  },
  clearAccess() {
    safeRemove(ACCESS_KEY)
  },
  setRefresh(token) {
    safeSet(REFRESH_KEY, token)
  },
  getRefresh() {
    return safeGet(REFRESH_KEY)
  },
  clearRefresh() {
    safeRemove(REFRESH_KEY)
  },
  setUser(user) {
    if (!user) {
      safeRemove(USER_KEY)
      return
    }
    // Phase 2: Мінімізація — зберігаємо мінімум для UI (ініціали, ім'я в header)
    const minimal = {
      id: user.id,
      role: user.role,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      display_name: user.display_name || user.first_name || null,
    }
    safeSet(USER_KEY, JSON.stringify(minimal))
  },
  getUser() {
    const raw = safeGet(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (error) {
      safeRemove(USER_KEY)
      return null
    }
  },
  clearUser() {
    safeRemove(USER_KEY)
  },
  clearAll() {
    this.clearAccess()
    this.clearRefresh()
    this.clearUser()
    this.remove('auth_session')
  },
}
