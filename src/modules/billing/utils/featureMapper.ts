/**
 * Feature Mapper Utility (v0.77.0)
 * 
 * Maps feature codes to human-readable i18n labels
 * Ensures no raw i18n keys like "billing.features.X" appear in UI
 */

/**
 * Get human-readable feature name from feature code
 * @param featureCode - Feature code from backend (e.g., "CONTACT_UNLOCK", "PRIORITY_SUPPORT")
 * @param t - i18n translate function
 * @returns Translated feature label
 */
export function getFeatureName(featureCode: string, t: (key: string) => string): string {
  if (!featureCode) {
    return ''
  }

  const code = featureCode.toUpperCase()
  const key = `billing.features.${code}`
  const translated = t(key)
  
  // If translation returns the key itself, it means translation is missing
  // Return a fallback human-readable version
  if (translated === key) {
    return formatFeatureCodeAsFallback(code)
  }
  
  return translated
}

/**
 * Format feature code as fallback when translation is missing
 * Converts "CONTACT_UNLOCK" to "Contact Unlock"
 */
function formatFeatureCodeAsFallback(code: string): string {
  return code
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Get all available feature codes
 * Used for validation and testing
 */
export const KNOWN_FEATURES = [
  'CONTACT_UNLOCK',
  'PRIORITY_SUPPORT',
  'ANALYTICS',
  'ADVANCED_SCHEDULING',
  'CUSTOM_BRANDING',
  'API_ACCESS',
  'UNLIMITED_STUDENTS',
  'VIDEO_CALLS',
  'SCREEN_SHARING',
  'HOMEWORK_TRACKING',
  'PROGRESS_REPORTS',
  'CALENDAR_INTEGRATION',
  'EMAIL_NOTIFICATIONS',
  'SMS_NOTIFICATIONS',
  'CUSTOM_DOMAIN',
  'WHITE_LABEL',
  'DEDICATED_SUPPORT',
  'ONBOARDING_ASSISTANCE'
] as const

export type FeatureCode = typeof KNOWN_FEATURES[number]

/**
 * Check if feature code is known
 */
export function isKnownFeature(code: string): code is FeatureCode {
  return KNOWN_FEATURES.includes(code as FeatureCode)
}
