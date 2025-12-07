const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '/')

function getAbsoluteBase() {
  if (/^https?:\/\//i.test(MEDIA_BASE_URL)) {
    return MEDIA_BASE_URL
  }
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : ''
  try {
    return new URL(MEDIA_BASE_URL, origin || 'http://localhost').toString()
  } catch (error) {
    return origin || ''
  }
}

const ABS_MEDIA_BASE = getAbsoluteBase()

export function resolveMediaUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  try {
    return new URL(url, ABS_MEDIA_BASE || window?.location?.origin || '').toString()
  } catch (error) {
    return url
  }
}
