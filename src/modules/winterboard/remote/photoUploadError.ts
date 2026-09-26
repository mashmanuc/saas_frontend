// Телефон: чому фото не завантажилось — ключ повідомлення для вчителя (LAW §9 v1.9).
// Жодних автоматичних повторів (LAW §12): вчитель бачить причину й сам вирішує.

export type PhotoUploadErrorKey =
  | 'offline' | 'unsupported_format' | 'invalid_image' | 'image_too_large' | 'file_too_large'
  | 'auth' | 'forbidden' | 'rate_limited' | 'quota' | 'failed'

export interface PhotoUploadErrorInfo {
  key: PhotoUploadErrorKey
  params: Record<string, string | number>
}

export function photoUploadError(e: unknown): PhotoUploadErrorInfo {
  const resp = (e as { response?: { status?: number; data?: Record<string, unknown> } } | null)?.response
  if (!resp || typeof resp.status !== 'number') return { key: 'offline', params: {} }
  const code = resp.data?.error
  switch (resp.status) {
    case 400:
      if (code === 'unsupported_format' || code === 'invalid_image' || code === 'image_too_large') {
        return { key: code, params: {} }
      }
      if (code === 'file_too_large') {
        const limit = resp.data?.limit_mb
        // межа невідома — без «понад ? МБ», просто «завелике»
        return typeof limit === 'number'
          ? { key: 'file_too_large', params: { limit } }
          : { key: 'image_too_large', params: {} }
      }
      return { key: 'failed', params: {} }
    case 401: return { key: 'auth', params: {} }
    case 403: return { key: 'forbidden', params: {} }
    case 413: return { key: 'image_too_large', params: {} }
    case 429: return { key: 'rate_limited', params: {} }
    case 507: return { key: 'quota', params: {} }
    default: return { key: 'failed', params: {} }
  }
}
