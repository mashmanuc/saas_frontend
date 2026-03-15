// Phase 10 P3: YouTube URL parser utilities
// Ref: DAY3_AGENT_A.md — A3.2
// Zone: AGENT-A (utils/)
//
// Pure functions — no side effects, no network calls, no dependencies.
// Mirrors backend youtube_service.py patterns for consistency.

/**
 * Parse YouTube video ID from various URL formats.
 *
 * Supported formats:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/v/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *
 * Returns 11-char video ID string or null.
 */
export function parseYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Generate YouTube thumbnail URL from video ID.
 * Uses hqdefault (480×360) — good balance of quality and size.
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Generate YouTube embed URL from video ID.
 * rel=0 hides related videos, modestbranding=1 reduces YouTube branding.
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
}
