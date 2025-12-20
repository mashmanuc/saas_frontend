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

export const storage = {
  setAccess(token) {
    safeSet(ACCESS_KEY, token)
  },
  getAccess() {
    return safeGet(ACCESS_KEY)
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
    safeSet(USER_KEY, JSON.stringify(user))
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
  },
}
