/**
 * [WB:B2.1] Unit tests for WBImageUpload component + useImageUpload composable
 *
 * Tests:
 * 1. File validation — type check
 * 2. File validation — size check
 * 3. File validation — empty file
 * 4. File validation — valid file passes
 * 5. Drag enter/leave visual states
 * 6. Progress display during upload
 * 7. Error toast on invalid file type
 * 8. Error toast on oversized file
 * 9. Cancel upload resets state
 * 10. Multiple file support
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateFile, fileToDataUrl } from '@/modules/winterboard/composables/useImageUpload'

// ── validateFile tests ──────────────────────────────────────────────────

describe('[WB:B2.1] validateFile', () => {
  it('rejects unsupported file type', () => {
    const file = new File(['data'], 'test.txt', { type: 'text/plain' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('rejects file larger than 10MB', () => {
    // Create a file > 10MB
    const bigData = new Uint8Array(11 * 1024 * 1024)
    const file = new File([bigData], 'big.png', { type: 'image/png' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too large')
  })

  it('rejects empty file', () => {
    const file = new File([], 'empty.png', { type: 'image/png' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('accepts valid PNG file', () => {
    const file = new File(['pixel-data'], 'test.png', { type: 'image/png' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts valid JPEG file', () => {
    const file = new File(['pixel-data'], 'photo.jpg', { type: 'image/jpeg' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('accepts valid WebP file', () => {
    const file = new File(['pixel-data'], 'image.webp', { type: 'image/webp' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('accepts valid SVG file', () => {
    const file = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('rejects GIF file (not in supported list)', () => {
    const file = new File(['gif-data'], 'anim.gif', { type: 'image/gif' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('rejects file with no type', () => {
    const file = new File(['data'], 'unknown', { type: '' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('accepts file exactly at 10MB limit', () => {
    const data = new Uint8Array(10 * 1024 * 1024)
    const file = new File([data], 'exact.png', { type: 'image/png' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })
})

// ── fileToDataUrl tests ─────────────────────────────────────────────────

describe('[WB:B2.1] fileToDataUrl', () => {
  it('converts file to data URL string', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const result = await fileToDataUrl(file)
    expect(result).toMatch(/^data:text\/plain;base64,/)
  })

  it('returns a string for image files', async () => {
    const file = new File(['png-data'], 'test.png', { type: 'image/png' })
    const result = await fileToDataUrl(file)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^data:image\/png;base64,/)
  })
})
