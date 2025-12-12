// TASK FX5: Input Sanitization for board components

import type { ComponentType } from '../types'

/**
 * Sanitize text content to prevent XSS.
 */
export function sanitizeText(text: string): string {
  if (!text) return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Unescape sanitized text for display.
 */
export function unescapeText(text: string): string {
  if (!text) return ''

  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

/**
 * Sanitize HTML content (for rich text).
 * Uses a whitelist approach for allowed tags and attributes.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''

  // Simple HTML sanitizer - for production, use DOMPurify
  const allowedTags = ['b', 'i', 'u', 'br', 'p', 'span', 'strong', 'em']
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi

  return html.replace(tagRegex, (match, tag) => {
    if (allowedTags.includes(tag.toLowerCase())) {
      // Strip all attributes except style
      if (match.includes('style=')) {
        const styleMatch = match.match(/style="([^"]*)"/)
        if (styleMatch) {
          const sanitizedStyle = sanitizeStyle(styleMatch[1])
          return match.replace(/style="[^"]*"/, `style="${sanitizedStyle}"`)
        }
      }
      // Return tag without attributes
      return match.includes('/') ? `</${tag}>` : `<${tag}>`
    }
    return ''
  })
}

/**
 * Sanitize inline styles.
 */
function sanitizeStyle(style: string): string {
  const allowedProperties = ['color', 'font-size', 'font-weight', 'text-align', 'background-color']
  const properties = style.split(';').filter(Boolean)

  return properties
    .map((prop) => {
      const [name, value] = prop.split(':').map((s) => s.trim())
      if (allowedProperties.includes(name.toLowerCase())) {
        // Block url() and expression()
        if (value.includes('url(') || value.includes('expression(')) {
          return ''
        }
        return `${name}: ${value}`
      }
      return ''
    })
    .filter(Boolean)
    .join('; ')
}

/**
 * Validate and sanitize image URL.
 */
export function validateImageUrl(url: string): string {
  if (!url) return ''

  // Allow internal paths
  if (url.startsWith('/media/') || url.startsWith('/static/') || url.startsWith('/uploads/')) {
    return url
  }

  // Allow data URLs for base64 images (with size limit check elsewhere)
  if (url.startsWith('data:image/')) {
    const allowedTypes = ['data:image/png', 'data:image/jpeg', 'data:image/gif', 'data:image/webp']
    if (allowedTypes.some((type) => url.startsWith(type))) {
      return url
    }
    return ''
  }

  try {
    const parsed = new URL(url)

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      console.warn('[sanitize] Non-HTTPS URL rejected:', url)
      return ''
    }

    // Block internal IPs
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.2') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      console.warn('[sanitize] Internal URL rejected:', url)
      return ''
    }

    return url
  } catch (error) {
    console.warn('[sanitize] Invalid URL:', url)
    return ''
  }
}

/**
 * Validate and sanitize component data based on type.
 */
export function sanitizeComponentData(
  type: ComponentType,
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...data }

  switch (type) {
    case 'text':
      if (typeof sanitized.content === 'string') {
        sanitized.content = sanitizeText(sanitized.content)
      }
      if (typeof sanitized.text === 'string') {
        sanitized.text = sanitizeText(sanitized.text)
      }
      break

    case 'sticky':
      if (typeof sanitized.content === 'string') {
        sanitized.content = sanitizeText(sanitized.content)
      }
      if (typeof sanitized.text === 'string') {
        sanitized.text = sanitizeText(sanitized.text)
      }
      break

    case 'image':
      if (typeof sanitized.url === 'string') {
        sanitized.url = validateImageUrl(sanitized.url)
      }
      if (typeof sanitized.src === 'string') {
        sanitized.src = validateImageUrl(sanitized.src)
      }
      break

    case 'connector':
      // Sanitize labels
      if (typeof sanitized.label === 'string') {
        sanitized.label = sanitizeText(sanitized.label)
      }
      break
  }

  return sanitized
}

/**
 * Validate file type for uploads.
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type)
}

/**
 * Validate file size.
 */
export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes
}

/**
 * Sanitize filename.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255)
}

export default {
  sanitizeText,
  unescapeText,
  sanitizeHtml,
  validateImageUrl,
  sanitizeComponentData,
  validateFileType,
  validateFileSize,
  sanitizeFilename,
}
