/**
 * Global page URL cache for DocumentViewerAsset.
 *
 * Shared across ALL viewer instances — one API call per content_id.
 * Pages are fetched lazily from content_json (pages/slides).
 */
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'

/** Global: content_id → Promise<Map<pageIndex, url>> */
const _cache = new Map<number, Promise<Map<number, string>>>()

/**
 * Fetch (or return cached) page URL map for a content item.
 * Returns Map<0-based-index, thumbnail_url>.
 * One API call per content_id — all viewers of the same document share the result.
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
    } catch (e) {
      console.warn('[DocumentPageCache] Failed to fetch pages for content_id=%d:', contentId, e)
      // Remove from cache so retry is possible
      _cache.delete(contentId)
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
