import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isSensitiveValue,
  isForbiddenKey,
  sanitizeObject,
  maskSensitiveValue,
  safeStorage,
  auditLocalStorage,
  cleanSensitiveData,
} from '../../src/core/security/sensitiveDataGuard'

describe('Sensitive Data Guard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('isSensitiveValue', () => {
    it('detects email addresses', () => {
      const result = isSensitiveValue('user@example.com')
      expect(result.isSensitive).toBe(true)
      expect(result.type).toBe('email')
    })

    it('detects JWT tokens', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const result = isSensitiveValue(token)
      expect(result.isSensitive).toBe(true)
      expect(result.type).toBe('token')
    })

    it('detects phone numbers', () => {
      const result = isSensitiveValue('+1 (555) 123-4567')
      expect(result.isSensitive).toBe(true)
      expect(result.type).toBe('phone')
    })

    it('returns false for non-sensitive values', () => {
      const result = isSensitiveValue('hello world')
      expect(result.isSensitive).toBe(false)
    })
  })

  describe('isForbiddenKey', () => {
    it('detects forbidden keys', () => {
      expect(isForbiddenKey('access_token')).toBe(true)
      expect(isForbiddenKey('refresh_token')).toBe(true)
      expect(isForbiddenKey('user_password')).toBe(true)
      expect(isForbiddenKey('api_key')).toBe(true)
    })

    it('allows safe keys', () => {
      expect(isForbiddenKey('user_preferences')).toBe(false)
      expect(isForbiddenKey('theme')).toBe(false)
      expect(isForbiddenKey('language')).toBe(false)
    })

    it('is case insensitive', () => {
      expect(isForbiddenKey('ACCESS_TOKEN')).toBe(true)
      expect(isForbiddenKey('Access_Token')).toBe(true)
    })
  })

  describe('sanitizeObject', () => {
    it('removes email fields', () => {
      const obj = {
        name: 'John',
        email: 'john@example.com',
        userEmail: 'john@example.com',
      }

      const sanitized = sanitizeObject(obj)

      expect(sanitized.name).toBe('John')
      expect(sanitized.email).toBeUndefined()
      expect(sanitized.userEmail).toBeUndefined()
    })

    it('removes password fields', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        passwordHash: 'abc123',
      }

      const sanitized = sanitizeObject(obj)

      expect(sanitized.username).toBe('john')
      expect(sanitized.password).toBeUndefined()
      expect(sanitized.passwordHash).toBeUndefined()
    })

    it('sanitizes nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      }

      const sanitized = sanitizeObject(obj)

      expect(sanitized.user.name).toBe('John')
      expect(sanitized.user.email).toBeUndefined()
    })

    it('handles arrays', () => {
      const obj = {
        users: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' },
        ],
      }

      const sanitized = sanitizeObject(obj)

      expect(sanitized.users[0].name).toBe('John')
      expect(sanitized.users[0].email).toBeUndefined()
    })
  })

  describe('maskSensitiveValue', () => {
    it('masks email addresses', () => {
      const masked = maskSensitiveValue('john.doe@example.com', 'email')
      expect(masked).toBe('jo***@example.com')
    })

    it('masks phone numbers', () => {
      const masked = maskSensitiveValue('1234567890', 'phone')
      expect(masked).toMatch(/\*+\d{4}/)
    })

    it('masks tokens', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const masked = maskSensitiveValue(token, 'token')
      expect(masked).toContain('...')
      expect(masked.length).toBeLessThan(token.length)
    })

    it('auto-detects type', () => {
      const masked = maskSensitiveValue('user@example.com', 'auto')
      expect(masked).toContain('***')
    })
  })

  describe('safeStorage', () => {
    it('blocks forbidden keys', () => {
      const result = safeStorage.setItem('access_token', 'secret')
      expect(result).toBe(false)
      expect(localStorage.getItem('access_token')).toBeNull()
    })

    it('allows safe keys', () => {
      const result = safeStorage.setItem('theme', 'dark')
      expect(result).toBe(true)
      expect(localStorage.getItem('theme')).toBe('dark')
    })

    it('sanitizes JSON values', () => {
      const data = JSON.stringify({
        name: 'John',
        email: 'john@example.com',
      })

      safeStorage.setItem('user_cache', data)

      const stored = JSON.parse(localStorage.getItem('user_cache'))
      expect(stored.name).toBe('John')
      expect(stored.email).toBeUndefined()
    })

    it('blocks raw tokens', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const result = safeStorage.setItem('some_data', token)
      expect(result).toBe(false)
    })
  })

  describe('auditLocalStorage', () => {
    it('finds forbidden keys', () => {
      localStorage.setItem('access_token', 'secret')

      const issues = auditLocalStorage()

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].type).toBe('forbidden_key')
      expect(issues[0].severity).toBe('high')
    })

    it('finds sensitive values in JSON', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'John',
        email: 'john@example.com',
      }))

      const issues = auditLocalStorage()

      const emailIssue = issues.find(i => i.dataType === 'email')
      expect(emailIssue).toBeDefined()
    })

    it('returns empty array for clean storage', () => {
      localStorage.setItem('theme', 'dark')
      localStorage.setItem('language', 'en')

      const issues = auditLocalStorage()

      expect(issues).toHaveLength(0)
    })
  })

  describe('cleanSensitiveData', () => {
    it('removes high severity issues', () => {
      localStorage.setItem('access_token', 'secret')
      localStorage.setItem('theme', 'dark')

      cleanSensitiveData()

      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('theme')).toBe('dark')
    })

    it('sanitizes medium severity issues', () => {
      localStorage.setItem('user', JSON.stringify({
        name: 'John',
        email: 'john@example.com',
      }))

      cleanSensitiveData()

      const user = JSON.parse(localStorage.getItem('user'))
      expect(user.name).toBe('John')
      expect(user.email).toBeUndefined()
    })
  })
})
