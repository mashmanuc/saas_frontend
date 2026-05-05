/**
 * Global page URL cache for DocumentViewerAsset.
 *
 * Shared across ALL viewer instances — one API call per content_id.
 * Pages are fetched lazily from content_json (pages/slides).
 *
 * Error policy (post 2026-05-05 audit):
 * - Fetch failure → cache STAYS (resolves з empty Map). Reactive consumers
 *   (e.g. DocumentViewerAsset watch on currentPage) НЕ re-fire запит.
 * - Error tracked у `_errors` Map для introspection + manual retry.
 * - Retry дозволено ТІЛЬКИ через explicit `retryDocumentPageCache(contentId)` —
 *   user-driven action, не automatic refetch що могло би створити infinite loop
 *   при sustained 429.
 */
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'

/** Global: content_id → Promise<Map<pageIndex, url>> (resolves навіть при error → empty Map) */
const _cache = new Map<number, Promise<Map<number, string>>>()

/** Last error per contentId — for introspection by error UI / manual retry. */
const _errors = new Map<number, { error: unknown; ts: number }>()

/**
 * Fetch (or return cached) page URL map for a content item.
 * Returns Map<0-based-index, thumbnail_url>.
 * One API call per content_id — all viewers of the same document share the result.
 *
 * NOTE: на error повертається cached empty Map. Promise НЕ rejects, бо reactive
 * consumers (watch у DocumentViewerAsset) могли б refetcher infinite times при
 * 429 storm. Для retry — `retryDocumentPageCache(contentId)`.
 */
export function getDocumentPageMap(
  contentId: number,
  contentType: string,
): Promise<Map<number, string>> {
  const existing = _cache.get(contentId)
  if (existing) return existing

  const promise = (async () => {
    const result = new Map<number, string>()
    try {
      const detail = await learningContentApi.getItemDetail(contentId)
      const raw = detail as unknown as Record<string, unknown>
      const cj = (raw.data as Record<string, unknown>)?.content_json
        ?? (raw.content_json as Record<string, unknown>)
        ?? {}

      const rawMap = contentType === 'presentation'
        ? ((cj as Record<string, unknown>).slides ?? {}) as Record<string, Record<string, string>>
        : ((cj as Record<string, unknown>).pages ?? {}) as Record<string, Record<string, string>>

      Object.entries(rawMap)
        .map(([num, data]) => ({
          key: parseInt(num, 10),
          url: data.thumbnail_url ?? data.image_url ?? '',
        }))
        .sort((a, b) => a.key - b.key)
        .forEach((entry, i) => {
          result.set(i, entry.url)
        })
      // Success → clear lingering error state, якщо був.
      _errors.delete(contentId)
    } catch (e) {
      // Track error, але НЕ видаляємо з cache. Reactive consumers отримають
      // empty Map і не будуть refire'ити запит → no infinite loop при 429.
      _errors.set(contentId, { error: e, ts: Date.now() })
      console.warn('[DocumentPageCache] Failed to fetch pages for content_id=%d (cached as empty, manual retry required):', contentId, e)
    }
    return result
  })()

  _cache.set(contentId, promise)
  return promise
}

/** Get URL for a specific page of a document. */
export async function getDocumentPageUrl(
  contentId: number,
  contentType: string,
  pageIndex: number,
): Promise<string | null> {
  const pageMap = await getDocumentPageMap(contentId, contentType)
  return pageMap.get(pageIndex) ?? null
}

/**
 * Inspect last error for a content item (null = no error or successfully fetched).
 * Use to display error UI / "retry" button.
 */
export function getDocumentPageCacheError(contentId: number): { error: unknown; ts: number } | null {
  return _errors.get(contentId) ?? null
}

/**
 * Explicitly invalidate cache for a content item (user-driven retry).
 * Next `getDocumentPageMap(contentId)` call → fresh fetch.
 *
 * MUST NOT be called from reactive watchers — це створить refetch loop
 * при sustained 429. Тільки з button click / explicit retry handler.
 */
export function retryDocumentPageCache(contentId: number): void {
  _cache.delete(contentId)
  _errors.delete(contentId)
}
