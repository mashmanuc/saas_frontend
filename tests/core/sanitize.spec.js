import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  unescapeHtml,
  sanitizeUrl,
  isSafeUrl,
  stripHtml,
  escapeJs,
  escapeCss,
  escapeUrl,
  sanitizeUserInput,
  sanitizeEmail,
  detectXss,
  generateCspHeader,
  CSP_DIRECTIVES,
} from '../../src/core/security/sanitize'

describe('Security Sanitization', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;')
      expect(escapeHtml("'test'")).toBe('&#x27;test&#x27;')
      expect(escapeHtml('a & b')).toBe('a &amp; b')
    })

    it('handles non-string input', () => {
      expect(escapeHtml(123)).toBe('123')
      expect(escapeHtml(null)).toBe('null')
    })

    it('returns empty string for empty input', () => {
      expect(escapeHtml('')).toBe('')
    })
  })

  describe('unescapeHtml', () => {
    it('unescapes HTML entities', () => {
      expect(unescapeHtml('&lt;script&gt;')).toBe('<script>')
      expect(unescapeHtml('&quot;test&quot;')).toBe('"test"')
      expect(unescapeHtml('a &amp; b')).toBe('a & b')
    })
  })

  describe('isSafeUrl', () => {
    it('allows safe URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true)
      expect(isSafeUrl('http://example.com')).toBe(true)
      expect(isSafeUrl('/path/to/page')).toBe(true)
      expect(isSafeUrl('#anchor')).toBe(true)
      expect(isSafeUrl('mailto:test@example.com')).toBe(true)
    })

    it('blocks dangerous URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
    })

    it('handles edge cases', () => {
      expect(isSafeUrl('')).toBe(false)
      expect(isSafeUrl(null)).toBe(false)
      expect(isSafeUrl(undefined)).toBe(false)
    })
  })

  describe('sanitizeUrl', () => {
    it('returns safe URLs unchanged', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    })

    it('returns # for dangerous URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#')
    })
  })

  describe('stripHtml', () => {
    it('removes all HTML tags', () => {
      expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
      expect(stripHtml('<script>alert(1)</script>')).toBe('alert(1)')
    })

    it('handles empty input', () => {
      expect(stripHtml('')).toBe('')
      expect(stripHtml(null)).toBe('')
    })
  })

  describe('escapeJs', () => {
    it('escapes JavaScript special characters', () => {
      expect(escapeJs("test'string")).toBe("test\\'string")
      expect(escapeJs('test"string')).toBe('test\\"string')
      expect(escapeJs('test\nstring')).toBe('test\\nstring')
    })
  })

  describe('escapeCss', () => {
    it('escapes CSS special characters', () => {
      const result = escapeCss('test.class')
      expect(result).toContain('\\')
    })
  })

  describe('escapeUrl', () => {
    it('encodes URL components', () => {
      expect(escapeUrl('hello world')).toBe('hello%20world')
      expect(escapeUrl('a=b&c=d')).toBe('a%3Db%26c%3Dd')
    })
  })

  describe('sanitizeUserInput', () => {
    it('trims whitespace by default', () => {
      expect(sanitizeUserInput('  hello  ')).toBe('hello')
    })

    it('escapes HTML by default', () => {
      expect(sanitizeUserInput('<script>')).toBe('&lt;script&gt;')
    })

    it('limits length when specified', () => {
      expect(sanitizeUserInput('hello world', { maxLength: 5 })).toBe('hello')
    })

    it('removes control characters', () => {
      expect(sanitizeUserInput('hello\x00world')).toBe('helloworld')
    })

    it('handles empty input', () => {
      expect(sanitizeUserInput('')).toBe('')
      expect(sanitizeUserInput(null)).toBe('')
    })
  })

  describe('sanitizeEmail', () => {
    it('validates and lowercases email', () => {
      expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com')
    })

    it('trims whitespace', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com')
    })

    it('returns empty for invalid email', () => {
      expect(sanitizeEmail('not-an-email')).toBe('')
      expect(sanitizeEmail('missing@domain')).toBe('')
    })
  })

  describe('detectXss', () => {
    it('detects script tags', () => {
      const result = detectXss('<script>alert(1)</script>')
      expect(result.hasXss).toBe(true)
    })

    it('detects javascript: protocol', () => {
      const result = detectXss('javascript:alert(1)')
      expect(result.hasXss).toBe(true)
    })

    it('detects event handlers', () => {
      const result = detectXss('<img onerror=alert(1)>')
      expect(result.hasXss).toBe(true)
    })

    it('returns false for safe content', () => {
      const result = detectXss('Hello, this is safe text')
      expect(result.hasXss).toBe(false)
    })
  })

  describe('generateCspHeader', () => {
    it('generates CSP header string', () => {
      const header = generateCspHeader(CSP_DIRECTIVES)
      
      expect(header).toContain("default-src 'self'")
      expect(header).toContain("object-src 'none'")
    })

    it('joins multiple sources', () => {
      const header = generateCspHeader({
        'script-src': ["'self'", "'unsafe-inline'"],
      })
      
      expect(header).toBe("script-src 'self' 'unsafe-inline'")
    })
  })

  describe('CSP_DIRECTIVES', () => {
    it('has required directives', () => {
      expect(CSP_DIRECTIVES['default-src']).toBeDefined()
      expect(CSP_DIRECTIVES['script-src']).toBeDefined()
      expect(CSP_DIRECTIVES['style-src']).toBeDefined()
      expect(CSP_DIRECTIVES['img-src']).toBeDefined()
    })

    it('blocks object-src', () => {
      expect(CSP_DIRECTIVES['object-src']).toContain("'none'")
    })

    it('blocks frame-ancestors', () => {
      expect(CSP_DIRECTIVES['frame-ancestors']).toContain("'none'")
    })
  })
})
