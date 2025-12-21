#!/usr/bin/env node

/**
 * security-manifest-check.mjs
 * 
 * Validates security-sensitive files and configurations for v0.38.0+
 * 
 * Checks:
 * - MFA setup wizard exists and has required components
 * - Session manager UI exists
 * - WebAuthn components exist (alpha)
 * - Realtime gateway health check exists
 * - Rate limit UX components exist
 * - I18n keys for new features exist
 * - Playwright smoke tests for auth/security exist
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const REQUIRED_FILES = [
  // MFA components
  'src/modules/profile/views/SettingsSecurityView.vue',
  'src/modules/auth/views/LoginView.vue',
  'src/modules/auth/api/authApi.js',
  
  // WebAuthn components (alpha)
  'src/modules/auth/components/WebAuthnEnrollModal.vue',
  'src/modules/auth/components/WebAuthnPrompt.vue',
  
  // Marketplace components
  'src/modules/marketplace/components/editor/CertificationsEditor.vue',
  'src/modules/marketplace/components/profile/TutorBadgeHistory.vue',
  'src/modules/marketplace/components/filters/FiltersStatusBanner.vue',
  'src/modules/marketplace/api/marketplace.ts',
  
  // Classroom realtime components
  'src/modules/classroom/components/ConnectionHealthBanner.vue',
  'src/modules/classroom/components/RateLimitedNotice.vue',
  'src/stores/realtimeStore.js',
  
  // Tests
  'tests/e2e/auth-security.smoke.spec.ts',
  
  // I18n
  'src/i18n/locales/uk.json',
  'src/i18n/locales/en.json',
]

const REQUIRED_I18N_KEYS = {
  uk: [
    'auth.login.webauthn.enrollTitle',
    'auth.login.webauthn.promptTitle',
    'profile.security.mfa.setupTitle',
    'profile.security.sessions.title',
    'marketplace.filters.cacheExpiredTitle',
    'marketplace.profile.badgesHistory.title',
    'classroom.realtime.statusConnected',
    'classroom.realtime.rateLimitedTitle',
  ],
  en: [
    'auth.login.webauthn.enrollTitle',
    'auth.login.webauthn.promptTitle',
    'profile.security.mfa.setupTitle',
    'profile.security.sessions.title',
    'marketplace.filters.cacheExpiredTitle',
    'marketplace.profile.badgesHistory.title',
    'classroom.realtime.statusConnected',
    'classroom.realtime.rateLimitedTitle',
  ],
}

const REQUIRED_TEST_PATTERNS = [
  'login switches to OTP step when API requires MFA',
  'sessions revoke shows success toast/message and reloads list',
]

let errors = []
let warnings = []

function checkFileExists(filePath) {
  const fullPath = path.join(projectRoot, filePath)
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required file: ${filePath}`)
    return false
  }
  return true
}

function checkI18nKey(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  
  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return false
    }
    current = current[key]
  }
  
  return true
}

function checkI18nKeys(locale, keys) {
  const i18nPath = path.join(projectRoot, `src/i18n/locales/${locale}.json`)
  
  if (!fs.existsSync(i18nPath)) {
    errors.push(`Missing i18n file: ${locale}.json`)
    return
  }
  
  let i18nData
  try {
    const content = fs.readFileSync(i18nPath, 'utf-8')
    i18nData = JSON.parse(content)
  } catch (err) {
    errors.push(`Failed to parse i18n file ${locale}.json: ${err.message}`)
    return
  }
  
  for (const key of keys) {
    if (!checkI18nKey(i18nData, key)) {
      errors.push(`Missing i18n key in ${locale}.json: ${key}`)
    }
  }
}

function checkTestFile() {
  const testPath = path.join(projectRoot, 'tests/e2e/auth-security.smoke.spec.ts')
  
  if (!fs.existsSync(testPath)) {
    errors.push('Missing smoke test file: tests/e2e/auth-security.smoke.spec.ts')
    return
  }
  
  const content = fs.readFileSync(testPath, 'utf-8')
  
  for (const pattern of REQUIRED_TEST_PATTERNS) {
    if (!content.includes(pattern)) {
      warnings.push(`Test pattern not found in smoke tests: "${pattern}"`)
    }
  }
}

function checkComponentContent(filePath, requiredStrings) {
  const fullPath = path.join(projectRoot, filePath)
  
  if (!fs.existsSync(fullPath)) {
    return
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8')
  
  for (const str of requiredStrings) {
    if (!content.includes(str)) {
      warnings.push(`Component ${filePath} missing expected content: "${str}"`)
    }
  }
}

console.log('🔒 Running security manifest check for v0.38.0...\n')

// Check required files
console.log('📁 Checking required files...')
for (const file of REQUIRED_FILES) {
  checkFileExists(file)
}

// Check i18n keys
console.log('🌐 Checking i18n keys...')
checkI18nKeys('uk', REQUIRED_I18N_KEYS.uk)
checkI18nKeys('en', REQUIRED_I18N_KEYS.en)

// Check test file
console.log('🧪 Checking smoke tests...')
checkTestFile()

// Check specific component content
console.log('🔍 Checking component implementations...')
checkComponentContent('src/modules/profile/views/SettingsSecurityView.vue', [
  'mfaSetup',
  'sessions',
  'revokeSession',
])
checkComponentContent('src/modules/auth/views/LoginView.vue', [
  'verifyMfa',
  'login-otp-input',
])
checkComponentContent('src/modules/marketplace/components/editor/CertificationsEditor.vue', [
  'putWithRetry',
  'uploadProgress',
])
checkComponentContent('src/modules/marketplace/components/filters/FiltersStatusBanner.vue', [
  'cacheExpired',
  'onRefresh',
])
checkComponentContent('src/modules/classroom/components/ConnectionHealthBanner.vue', [
  'status',
  'wsUrl',
])
checkComponentContent('src/modules/classroom/components/RateLimitedNotice.vue', [
  'retryAfterSeconds',
  'countdown',
])

// Report results
console.log('\n' + '='.repeat(60))

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All security manifest checks passed!')
  process.exit(0)
}

if (errors.length > 0) {
  console.log(`\n❌ Found ${errors.length} error(s):\n`)
  errors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err}`)
  })
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Found ${warnings.length} warning(s):\n`)
  warnings.forEach((warn, i) => {
    console.log(`  ${i + 1}. ${warn}`)
  })
}

console.log('\n' + '='.repeat(60))

if (errors.length > 0) {
  console.log('\n❌ Security manifest check failed!')
  process.exit(1)
}

console.log('\n✅ Security manifest check passed with warnings.')
process.exit(0)
