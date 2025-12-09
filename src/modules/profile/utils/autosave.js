import { debounce } from '../../../utils/debounce'

const DEFAULT_DELAY = 800

function normalizeString(value) {
  if (typeof value !== 'string') return value ?? ''
  return value.trim()
}

function arraysEqual(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function buildCurrentUser(form, timezoneFallback) {
  return {
    first_name: normalizeString(form.first_name),
    last_name: normalizeString(form.last_name),
    timezone: form.timezone || timezoneFallback || '',
  }
}

function buildCurrentProfile(form, subjects, role) {
  const baseProfile = {
    headline: normalizeString(form.headline),
    bio: form.bio ?? '',
  }

  if (role === 'tutor' || role === 'student') {
    baseProfile.subjects = Array.isArray(subjects) ? [...subjects] : []
  }

  return baseProfile
}

function profilesEqual(a = {}, b = {}) {
  if (a.headline !== b.headline) return false
  if (a.bio !== b.bio) return false
  const subjectsA = Array.isArray(a.subjects) ? a.subjects : []
  const subjectsB = Array.isArray(b.subjects) ? b.subjects : []
  return arraysEqual(subjectsA, subjectsB)
}

export function buildDirtyPayload({ snapshot, form, subjects, role, timezoneFallback }) {
  const payload = {}
  const currentUser = buildCurrentUser(form, timezoneFallback)
  const baseUser = buildCurrentUser(snapshot?.user || {}, timezoneFallback)

  const userChanged =
    currentUser.first_name !== baseUser.first_name ||
    currentUser.last_name !== baseUser.last_name ||
    currentUser.timezone !== baseUser.timezone

  if (userChanged) {
    payload.user = currentUser
  }

  const currentProfile = buildCurrentProfile(form, subjects, role)
  const baseProfile = buildCurrentProfile(snapshot?.profile || {}, snapshot?.subjects || [], role)

  const profileChanged = !profilesEqual(currentProfile, baseProfile)

  if (profileChanged) {
    const profileKey = role === 'tutor' ? 'tutor_profile' : role === 'student' ? 'student_profile' : 'profile'
    payload[profileKey] = currentProfile
  }

  return payload
}

export function hasDirtyChanges(payload) {
  if (!payload || typeof payload !== 'object') return false
  return Object.keys(payload).length > 0
}

export function createAutosaveScheduler(handler, delay = DEFAULT_DELAY) {
  const debounced = debounce(async (payload) => {
    await handler?.(payload)
  }, delay)

  return {
    schedule(payload) {
      debounced(payload)
    },
    cancel() {
      debounced.cancel?.()
    },
  }
}
