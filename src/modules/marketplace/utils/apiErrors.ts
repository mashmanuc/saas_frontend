export type MarketplaceValidationErrors = Record<string, string[]>

export type MarketplaceApiErrorInfo = {
  status: number | null
  code: string | null
  detail: string | null
  fields: MarketplaceValidationErrors | null
}

export function parseMarketplaceApiError(err: unknown): MarketplaceApiErrorInfo {
  const anyErr = err as any
  const status = anyErr?.response?.status ?? null
  const data = anyErr?.response?.data

  const code = (data?.error ?? data?.code ?? null) as string | null
  const detail = (data?.detail ?? data?.message ?? null) as string | null

  let fields: MarketplaceValidationErrors | null = null
  if (status === 422 && data && typeof data === 'object') {
    const raw = (data as any).fields && typeof (data as any).fields === 'object' ? (data as any).fields : (data as any).errors
    if (raw && typeof raw === 'object') {
      const next: MarketplaceValidationErrors = {}
      for (const [k, v] of Object.entries(raw)) {
        if (k === 'detail' || k === 'error') continue
        if (Array.isArray(v)) next[k] = v.map((x) => String(x))
        else if (typeof v === 'string') next[k] = [v]
        else if (v != null) next[k] = [JSON.stringify(v)]
      }
      fields = Object.keys(next).length ? next : null
    }
  }

  return { status, code, detail, fields }
}

export function mapMarketplaceErrorToMessage(info: MarketplaceApiErrorInfo, fallback: string): string {
  if (info.status === 422 || info.code === 'validation_failed') {
    return 'Перевірте коректність даних.'
  }
  if (info.status === 409 || info.code === 'slot_conflict') {
    return 'Слот вже зайнятий. Оберіть інший час.'
  }
  if (info.status === 429 || info.code === 'rate_limited') {
    return 'Забагато запитів. Спробуйте трохи пізніше.'
  }
  if (info.status === 413 || info.code === 'payload_too_large') {
    return 'Дані завеликі. Зменшіть обсяг і спробуйте ще раз.'
  }
  if (info.status === 403 || info.code === 'forbidden') {
    return 'Доступ заборонено.'
  }
  if (typeof info.status === 'number' && info.status >= 500) {
    return 'Помилка сервера. Спробуйте пізніше.'
  }
  return info.detail || fallback
}
