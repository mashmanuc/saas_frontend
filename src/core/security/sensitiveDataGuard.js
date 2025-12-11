/**
 * Sensitive Data Guard — v0.15.0
 * Захист чутливих даних: видалення email з кешу, токени у httpOnly cookie
 */

/**
 * Sensitive data patterns
 */
const SENSITIVE_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-()]{10,}$/,
  token: /^eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/,
  creditCard: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
  ssn: /^\d{3}-?\d{2}-?\d{4}$/,
}

/**
 * Sensitive localStorage keys to avoid
 */
const FORBIDDEN_STORAGE_KEYS = [
  'access_token',
  'refresh_token',
  'auth_token',
  'jwt',
  'password',
  'secret',
  'api_key',
  'private_key',
]

/**
 * Keys that should not contain sensitive data
 */
const SANITIZE_KEYS = [
  'user_cache',
  'profile_cache',
  'session_data',
]

/**
 * Check if value looks like sensitive data
 */
export function isSensitiveValue(value) {
  if (typeof value !== 'string') return false
  
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (pattern.test(value)) {
      return { isSensitive: true, type }
    }
  }
  
  return { isSensitive: false, type: null }
}

/**
 * Check if key is forbidden for localStorage
 */
export function isForbiddenKey(key) {
  const lowerKey = key.toLowerCase()
  return FORBIDDEN_STORAGE_KEYS.some(forbidden => 
    lowerKey.includes(forbidden.toLowerCase())
  )
}

/**
 * Sanitize object by removing sensitive fields
 */
export function sanitizeObject(obj, fieldsToRemove = ['email', 'phone', 'password', 'token']) {
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj }
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase()
    
    // Remove sensitive fields
    if (fieldsToRemove.some(field => lowerKey.includes(field.toLowerCase()))) {
      delete sanitized[key]
      continue
    }
    
    // Recursively sanitize nested objects
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key], fieldsToRemove)
    }
  }
  
  return sanitized
}

/**
 * Mask sensitive value for display
 */
export function maskSensitiveValue(value, type = 'auto') {
  if (!value || typeof value !== 'string') return value
  
  // Auto-detect type
  if (type === 'auto') {
    const detected = isSensitiveValue(value)
    type = detected.type || 'default'
  }
  
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@')
      if (!domain) return '***'
      return `${local.slice(0, 2)}***@${domain}`
    
    case 'phone':
      return value.replace(/\d(?=\d{4})/g, '*')
    
    case 'token':
      return `${value.slice(0, 10)}...${value.slice(-5)}`
    
    case 'creditCard':
      return value.replace(/\d(?=\d{4})/g, '*')
    
    default:
      if (value.length <= 4) return '***'
      return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`
  }
}

/**
 * Safe localStorage wrapper that prevents storing sensitive data
 */
export const safeStorage = {
  setItem(key, value) {
    // Check forbidden keys
    if (isForbiddenKey(key)) {
      console.warn(`[sensitiveDataGuard] Blocked storing sensitive key: ${key}`)
      return false
    }
    
    // Parse and sanitize JSON values
    let sanitizedValue = value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        const sanitized = sanitizeObject(parsed)
        sanitizedValue = JSON.stringify(sanitized)
      } catch {
        // Not JSON, check if it's a sensitive value
        const check = isSensitiveValue(value)
        if (check.isSensitive && check.type === 'token') {
          console.warn(`[sensitiveDataGuard] Blocked storing token in localStorage`)
          return false
        }
      }
    }
    
    try {
      localStorage.setItem(key, sanitizedValue)
      return true
    } catch (error) {
      console.error('[sensitiveDataGuard] localStorage error:', error)
      return false
    }
  },
  
  getItem(key) {
    return localStorage.getItem(key)
  },
  
  removeItem(key) {
    localStorage.removeItem(key)
  },
  
  clear() {
    localStorage.clear()
  },
}

/**
 * Audit localStorage for sensitive data
 */
export function auditLocalStorage() {
  const issues = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    // Check forbidden keys
    if (isForbiddenKey(key)) {
      issues.push({
        type: 'forbidden_key',
        key,
        severity: 'high',
        message: `Forbidden key found: ${key}`,
      })
      continue
    }
    
    // Check value for sensitive data
    const value = localStorage.getItem(key)
    if (!value) continue
    
    try {
      const parsed = JSON.parse(value)
      const sensitiveFields = findSensitiveFields(parsed)
      
      for (const field of sensitiveFields) {
        issues.push({
          type: 'sensitive_field',
          key,
          field: field.path,
          dataType: field.type,
          severity: 'medium',
          message: `Sensitive ${field.type} found in ${key}.${field.path}`,
        })
      }
    } catch {
      // Check raw value
      const check = isSensitiveValue(value)
      if (check.isSensitive) {
        issues.push({
          type: 'sensitive_value',
          key,
          dataType: check.type,
          severity: check.type === 'token' ? 'high' : 'medium',
          message: `Sensitive ${check.type} stored in ${key}`,
        })
      }
    }
  }
  
  return issues
}

/**
 * Find sensitive fields in object
 */
function findSensitiveFields(obj, path = '') {
  const fields = []
  
  if (!obj || typeof obj !== 'object') {
    const check = isSensitiveValue(obj)
    if (check.isSensitive) {
      fields.push({ path, type: check.type })
    }
    return fields
  }
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    
    if (typeof value === 'string') {
      const check = isSensitiveValue(value)
      if (check.isSensitive) {
        fields.push({ path: currentPath, type: check.type })
      }
    } else if (typeof value === 'object' && value !== null) {
      fields.push(...findSensitiveFields(value, currentPath))
    }
  }
  
  return fields
}

/**
 * Clean sensitive data from localStorage
 */
export function cleanSensitiveData() {
  const issues = auditLocalStorage()
  const cleaned = []
  
  for (const issue of issues) {
    if (issue.severity === 'high') {
      localStorage.removeItem(issue.key)
      cleaned.push(issue.key)
    } else if (issue.type === 'sensitive_field') {
      // Sanitize and re-save
      try {
        const value = localStorage.getItem(issue.key)
        if (value) {
          const parsed = JSON.parse(value)
          const sanitized = sanitizeObject(parsed)
          localStorage.setItem(issue.key, JSON.stringify(sanitized))
          cleaned.push(`${issue.key} (sanitized)`)
        }
      } catch {
        // Skip if can't parse
      }
    }
  }
  
  return cleaned
}

/**
 * Initialize sensitive data guard
 */
export function initSensitiveDataGuard(options = {}) {
  const { autoClean = true, auditOnInit = true } = options
  
  if (auditOnInit) {
    const issues = auditLocalStorage()
    if (issues.length > 0) {
      console.warn('[sensitiveDataGuard] Found sensitive data issues:', issues)
      
      if (autoClean) {
        const cleaned = cleanSensitiveData()
        console.info('[sensitiveDataGuard] Cleaned:', cleaned)
      }
    }
  }
  
  return {
    audit: auditLocalStorage,
    clean: cleanSensitiveData,
    sanitize: sanitizeObject,
    mask: maskSensitiveValue,
    safeStorage,
  }
}

export default {
  initSensitiveDataGuard,
  auditLocalStorage,
  cleanSensitiveData,
  sanitizeObject,
  maskSensitiveValue,
  isSensitiveValue,
  isForbiddenKey,
  safeStorage,
}
