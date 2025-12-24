import DOMPurify from 'dompurify'

/**
 * Sanitize user input to prevent XSS attacks
 * Removes all HTML tags and dangerous content
 */
export function sanitizeComment(comment: string): string {
  if (!comment) return ''
  
  return DOMPurify.sanitize(comment, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim()
}

/**
 * Sanitize HTML content while allowing safe tags
 */
export function sanitizeHTML(html: string): string {
  if (!html) return ''
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  })
}
