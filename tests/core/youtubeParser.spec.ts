// Phase 10 P3: Unit tests for YouTube URL parser
// Ref: DAY3_AGENT_A.md — A3.6

import { describe, it, expect } from 'vitest'
import {
  parseYouTubeVideoId,
  getYouTubeThumbnail,
  getYouTubeEmbedUrl,
} from '@/modules/winterboard/utils/youtubeParser'

describe('parseYouTubeVideoId', () => {
  it('parses youtube.com/watch?v=', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses youtu.be/', () => {
    expect(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses youtube.com/embed/', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses youtube.com/shorts/', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses youtube.com/v/', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses with extra query params', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('dQw4w9WgXcQ')
  })

  it('parses without www prefix', () => {
    expect(parseYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for non-YouTube URL', () => {
    expect(parseYouTubeVideoId('https://example.com/video')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseYouTubeVideoId('')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parseYouTubeVideoId('not-a-url')).toBeNull()
  })
})

describe('getYouTubeThumbnail', () => {
  it('returns hqdefault thumbnail URL', () => {
    expect(getYouTubeThumbnail('dQw4w9WgXcQ')).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
  })
})

describe('getYouTubeEmbedUrl', () => {
  it('returns embed URL with modestbranding', () => {
    expect(getYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    )
  })
})
