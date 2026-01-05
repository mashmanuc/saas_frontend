/**
 * Prevents calendar-e2e suite from running against production.
 * Throws immediately if E2E_ENV=prod or E2E_BASE_URL points to a prod domain.
 */

const PROD_ENV_NAME = 'prod'
const PROD_DOMAINS = [
  'm4sh.pp.ua',
  'app.m4sh.ua',
]

export function ensureCalendarE2EEnvSafe() {
  const envName = (process.env.E2E_ENV || '').toLowerCase()
  const baseUrl = (process.env.E2E_BASE_URL || '').toLowerCase()

  if (envName === PROD_ENV_NAME) {
    throw new Error('[calendar-e2e] Running on E2E_ENV=prod is forbidden')
  }

  if (baseUrl && PROD_DOMAINS.some(domain => baseUrl.includes(domain))) {
    throw new Error(`[calendar-e2e] Base URL "${baseUrl}" looks like production; aborting`)
  }
}

ensureCalendarE2EEnvSafe()
