/**
 * Security Sanitization — v0.16.0
 * Sanitize HTML у chat, CSP meta-tag injection, escape для user input
 */

/**
 * Allowed HTML tags for chat messages
 */
const ALLOWED_TAGS = [
  'b', 'i', 'u', 's', 'strong', 'em', 'code', 'pre',
  'br', 'p', 'span', 'a', 'ul', 'ol', 'li',
]

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'target', 'rel'],
  span: ['class'],
  code: ['class'],
  pre: ['class'],
}

/**
 * Dangerous URL protocols
 */
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
]

/**
 * HTML entities map
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') {
    return String(str)
  }
  
  return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char])
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(str) {
  if (typeof str !== 'string') {
    return String(str)
  }
  
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
  }
  
  return str.replace(/&(?:amp|lt|gt|quot|#x27|#x2F|#x60|#x3D);/g, entity => entities[entity] || entity)
}

/**
 * Check if URL is safe
 */
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') {
    return false
  }
  
  const trimmed = url.trim().toLowerCase()
  
  // Check for dangerous protocols
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(protocol)) {
      return false
    }
  }
  
  // Allow relative URLs, http, https, mailto
  if (trimmed.startsWith('/') || 
      trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('#')) {
    return true
  }
  
  // Disallow other protocols
  if (trimmed.includes(':')) {
    return false
  }
  
  return true
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url) {
  if (!isSafeUrl(url)) {
    return '#'
  }
  return url
}

/**
 * Sanitize HTML string (simple implementation)
 */
export function sanitizeHtml(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return ''
  }
  
  const allowedTags = options.allowedTags || ALLOWED_TAGS
  const allowedAttributes = options.allowedAttributes || ALLOWED_ATTRIBUTES
  
  // Create a temporary DOM element
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // Recursively sanitize
  sanitizeNode(temp, allowedTags, allowedAttributes)
  
  return temp.innerHTML
}

/**
 * Sanitize DOM node recursively
 */
function sanitizeNode(node, allowedTags, allowedAttributes) {
  const children = Array.from(node.childNodes)
  
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase()
      
      // Remove disallowed tags
      if (!allowedTags.includes(tagName)) {
        // Keep text content but remove the tag
        const textContent = child.textContent
        const textNode = document.createTextNode(textContent)
        node.replaceChild(textNode, child)
        continue
      }
      
      // Sanitize attributes
      const attrs = Array.from(child.attributes)
      const allowedAttrs = allowedAttributes[tagName] || []
      
      for (const attr of attrs) {
        if (!allowedAttrs.includes(attr.name)) {
          child.removeAttribute(attr.name)
          continue
        }
        
        // Special handling for href
        if (attr.name === 'href') {
          if (!isSafeUrl(attr.value)) {
            child.removeAttribute('href')
          } else {
            // Add security attributes for external links
            if (attr.value.startsWith('http')) {
              child.setAttribute('rel', 'noopener noreferrer')
              child.setAttribute('target', '_blank')
            }
          }
        }
        
        // Remove event handlers
        if (attr.name.startsWith('on')) {
          child.removeAttribute(attr.name)
        }
      }
      
      // Recursively sanitize children
      sanitizeNode(child, allowedTags, allowedAttributes)
    } else if (child.nodeType === Node.COMMENT_NODE) {
      // Remove comments
      node.removeChild(child)
    }
  }
}

/**
 * Strip all HTML tags
 */
export function stripHtml(html) {
  if (!html || typeof html !== 'string') {
    return ''
  }
  
  const temp = document.createElement('div')
  temp.innerHTML = html
  return temp.textContent || temp.innerText || ''
}

/**
 * Escape for use in JavaScript string
 */
export function escapeJs(str) {
  if (typeof str !== 'string') {
    return String(str)
  }
  
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * Escape for use in CSS
 */
export function escapeCss(str) {
  if (typeof str !== 'string') {
    return String(str)
  }
  
  return str.replace(/[^\w-]/g, char => `\\${char.charCodeAt(0).toString(16)} `)
}

/**
 * Escape for use in URL
 */
export function escapeUrl(str) {
  if (typeof str !== 'string') {
    return String(str)
  }
  
  return encodeURIComponent(str)
}

/**
 * CSP (Content Security Policy) configuration
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"], // Adjust based on needs
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': ["'self'", 'wss:', 'https:'],
  'media-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
}

/**
 * Generate CSP header value
 */
export function generateCspHeader(directives = CSP_DIRECTIVES) {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}

/**
 * Inject CSP meta tag
 */
export function injectCspMetaTag(directives = CSP_DIRECTIVES) {
  // Remove existing CSP meta tag
  const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  if (existing) {
    existing.remove()
  }
  
  // Create new meta tag
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = generateCspHeader(directives)
  
  // Insert at the beginning of head
  const head = document.head || document.getElementsByTagName('head')[0]
  head.insertBefore(meta, head.firstChild)
  
  return meta
}

/**
 * Sanitize user input for display
 */
export function sanitizeUserInput(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  let result = input
  
  // Trim whitespace
  if (options.trim !== false) {
    result = result.trim()
  }
  
  // Limit length
  if (options.maxLength && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength)
  }
  
  // Escape HTML
  if (options.escapeHtml !== false) {
    result = escapeHtml(result)
  }
  
  // Remove control characters
  if (options.removeControlChars !== false) {
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  }
  
  return result
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return ''
  }
  
  const trimmed = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(trimmed)) {
    return ''
  }
  
  return trimmed
}

/**
 * Create safe innerHTML setter
 */
export function createSafeInnerHtml(element, html, options = {}) {
  element.innerHTML = sanitizeHtml(html, options)
}

/**
 * XSS detection patterns
 */
const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*['"]?\s*javascript:/gi,
]

/**
 * Detect potential XSS in string
 */
export function detectXss(str) {
  if (!str || typeof str !== 'string') {
    return { hasXss: false, patterns: [] }
  }
  
  const detected = []
  
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(str)) {
      detected.push(pattern.source)
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
  }
  
  return {
    hasXss: detected.length > 0,
    patterns: detected,
  }
}

export default {
  escapeHtml,
  unescapeHtml,
  sanitizeHtml,
  stripHtml,
  sanitizeUrl,
  isSafeUrl,
  escapeJs,
  escapeCss,
  escapeUrl,
  sanitizeUserInput,
  sanitizeEmail,
  createSafeInnerHtml,
  detectXss,
  generateCspHeader,
  injectCspMetaTag,
  CSP_DIRECTIVES,
}
