/**
 * Playwright Global Setup
 * Виконується один раз перед усіма тестами
 */

import { chromium, FullConfig } from '@playwright/test'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure test-results directory exists to prevent ENOENT errors
const testResultsDir = path.resolve(process.cwd(), 'test-results')
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true })
}

/**
 * Run E2E seed command to prepare deterministic data
 */
async function runE2ESeed() {
  if (process.env.E2E_SKIP_SEED === '1') {
    console.log('[global-setup] Skipping seed (E2E_SKIP_SEED=1)')
    return
  }

  console.log('[global-setup] Running e2e_seed_calendar...')
  
  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  const backendDir = path.join(repoRoot, 'backend')
  const pythonExec = process.env.E2E_PYTHON || path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  
  try {
    execFileSync(pythonExec, ['manage.py', 'e2e_seed_calendar'], {
      cwd: backendDir,
      stdio: 'inherit'
    })
    console.log('[global-setup] ✓ Seed completed')
  } catch (error: any) {
    console.error('[global-setup] ❌ Seed failed:', error.message)
    throw new Error('E2E seed command failed. Ensure backend/.venv exists and Django is configured.')
  }
}

type SanityAttempt = {
  url: string
  status: number
  body: string
}

function asYmd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function summarizeAttempts(attempts: SanityAttempt[]): string {
  return attempts
    .map(a => `- ${a.status} ${a.url}\n  body: ${a.body.slice(0, 400).replace(/\s+/g, ' ')}`)
    .join('\n')
}

/**
 * Sanity check: verify that calendar data is available via API
 * Uses contract probing to find correct query params
 */
async function verifySeedData(apiURL: string, accessToken: string, tutorId: number) {
  if (!tutorId) {
    throw new Error('verifySeedData requires tutorId')
  }
  console.log('[global-setup] Verifying seed data via API...')
  
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  const MAX_RETRIES = 5
  let retryCount = 0
  
  try {
    const weekStart = asYmd(startOfWeekMonday(new Date()))
    const base = `${apiURL}/v1/calendar/week/v055/`
    const tz = 'Europe/Kiev'
    
    const variants: Array<Record<string, string>> = [
      { tutorId: String(tutorId), weekStart, timezone: tz },
      { tutor_id: String(tutorId), weekStart, timezone: tz },
      { tutor_id: String(tutorId), week_start: weekStart, timezone: tz },
      { tutor_id: String(tutorId), start: weekStart, timezone: tz },
    ]
    
    const attempts: SanityAttempt[] = []
    
    for (const q of variants) {
      const qs = new URLSearchParams(q).toString()
      const url = `${base}?${qs}`
      
      try {
        const response = await page.request.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          }
        })
        
        const body = await response.text()
        attempts.push({ url, status: response.status(), body })
        
        // v0.92.1: Handle 429 Rate Limited with retry/backoff
        if (response.status() === 429) {
          retryCount++
          if (retryCount > MAX_RETRIES) {
            throw new Error(
              `[global-setup] Rate limited (429) after ${MAX_RETRIES} retries.\n` +
              `URL: ${url}\nBody: ${body.slice(0, 400)}`
            )
          }
          
          // Parse Retry-After header or extract from body
          let retryAfter = parseInt(response.headers()['retry-after'] || '0', 10)
          if (!retryAfter) {
            try {
              const data = JSON.parse(body)
              retryAfter = data.retry_after_seconds || data.retryAfter || 5
            } catch {
              retryAfter = 5 // default backoff
            }
          }
          
          console.log(`[global-setup] ⚠️  Rate limited (429), retry ${retryCount}/${MAX_RETRIES} after ${retryAfter}s`)
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
          
          // Retry this variant
          const retryResponse = await page.request.get(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json'
            }
          })
          const retryBody = await retryResponse.text()
          attempts.push({ url: `${url} (retry)`, status: retryResponse.status(), body: retryBody })
          
          if (retryResponse.status() === 200) {
            let data: any = null
            try {
              data = JSON.parse(retryBody)
            } catch {
              console.log('[global-setup] Warning: 200 response but not valid JSON')
            }
            
            const accessible =
              data?.accessibleSlots ??
              data?.accessible ??
              data?.data?.accessibleSlots ??
              data?.result?.accessibleSlots
            
            const count = Array.isArray(accessible) ? accessible.length : null
            
            console.log(`[global-setup] ✅ Sanity-check OK via: ${url} (after retry)`)
            
            if (count === null) {
              console.log('[global-setup] (note) Could not locate accessible slots array in response, but endpoint is 200.')
              return
            }
            
            if (count > 0) {
              console.log(`[global-setup] ✓ Seed data verified: ${count} accessible slots`)
              return
            }
            
            throw new Error(
              `[global-setup] Endpoint 200 but accessible slots empty. This usually means backend not in E2E_MODE=1 or seed data not visible.\n` +
              `URL: ${url}`
            )
          }
          
          // If retry also failed with non-200, continue to next variant
          continue
        }
        
        if (response.status() === 200) {
          let data: any = null
          try {
            data = JSON.parse(body)
          } catch {
            console.log('[global-setup] Warning: 200 response but not valid JSON')
          }
          
          const accessible =
            data?.accessibleSlots ??
            data?.accessible ??
            data?.data?.accessibleSlots ??
            data?.result?.accessibleSlots
          
          const count = Array.isArray(accessible) ? accessible.length : null
          
          console.log(`[global-setup] ✅ Sanity-check OK via: ${url}`)
          
          if (count === null) {
            console.log('[global-setup] (note) Could not locate accessible slots array in response, but endpoint is 200.')
            return
          }
          
          if (count > 0) {
            console.log(`[global-setup] ✓ Seed data verified: ${count} accessible slots`)
            return
          }
          
          throw new Error(
            `[global-setup] Endpoint 200 but accessible slots empty. This usually means backend not in E2E_MODE=1 or seed data not visible.\n` +
            `URL: ${url}`
          )
        }
        
        if (response.status() === 401 || response.status() === 403) {
          throw new Error(
            `[global-setup] Auth failed during sanity-check (${response.status()}).\n` +
            `URL: ${url}\nBody: ${body.slice(0, 800)}`
          )
        }
      } catch (e: any) {
        if (e.message.includes('Auth failed') || e.message.includes('Endpoint 200')) {
          throw e
        }
        attempts.push({ url, status: -1, body: String(e?.message ?? e) })
      }
    }
    
    const report = summarizeAttempts(attempts)
    
    throw new Error(
      `[global-setup] ❌ Sanity-check failed: calendar endpoint never returned 200.\n` +
      `Most likely: wrong query params (tutor_id vs tutorId, week_start vs weekStart/start) or missing tz.\n` +
      `Tried weekStart=${weekStart}, tutorId=${tutorId}, tz=${tz}.\n` +
      `Attempts:\n${report}\n\n` +
      `If backend expects different contract, update verifySeedData() variants.`
    )
  } finally {
    await context.close()
    await browser.close()
  }
}

async function globalSetup(config: FullConfig) {
  console.log('[global-setup] Starting...')

  // v0.92.1: Check E2E_SCOPE to conditionally skip calendar seed/sanity-check
  const e2eScope = process.env.E2E_SCOPE || 'default'
  console.log(`[global-setup] E2E_SCOPE=${e2eScope}`)

  const skipCalendarSeed = e2eScope === 'dev-vertical'
  
  if (!skipCalendarSeed) {
    // Step 1: Run seed command (only for non-dev-vertical scopes)
    await runE2ESeed()
  } else {
    console.log('[global-setup] ✓ Skipping calendar seed for dev-vertical scope')
  }

  const authStateFile = path.join(__dirname, '.auth/user.json')
  const credentialsFile = path.join(__dirname, '.auth/credentials.json')
  const baseURL = config.projects[0].use.baseURL || 'http://127.0.0.1:4173'
  const apiURL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

  // Перевірити чи є збережений auth state
  if (fs.existsSync(authStateFile) && fs.existsSync(credentialsFile)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'))
      const timestamp = new Date(credentials.timestamp)
      const hoursSinceAuth = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60)

      // Якщо auth state свіжий (менше 1 години), використовуємо його
      if (hoursSinceAuth < 1) {
        if (credentials.access && credentials.user?.id) {
          console.log('[global-setup] ✓ Using existing auth state')
          if (!skipCalendarSeed) {
            await verifySeedData(apiURL, credentials.access, credentials.user.id)
          } else {
            console.log('[global-setup] ✓ Skipping calendar sanity-check for dev-vertical')
          }
          return
        }
        console.log('[global-setup] Auth state missing credentials, re-authenticating...')
      }
      console.log('[global-setup] Auth state is stale, re-authenticating...')
    } catch (error) {
      console.log('[global-setup] Failed to read auth state, re-authenticating...')
    }
  }

  // Якщо немає auth state або він застарів, виконуємо логін
  console.log('[global-setup] Authenticating test user...')

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Перевірка health backend
    const healthResponse = await page.request.get(`${apiURL}/health/`)
    if (!healthResponse.ok()) {
      throw new Error(`Backend health check failed: ${healthResponse.status()}`)
    }
    console.log('[global-setup] ✓ Backend is healthy')

    // Логін через API
    const loginResponse = await page.request.post(`${apiURL}/v1/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'm3@gmail.com',
        password: process.env.TEST_USER_PASSWORD || 'demo1234'
      }
    })

    if (!loginResponse.ok()) {
      const errorData = await loginResponse.json().catch(() => ({}))
      throw new Error(`Login failed: ${loginResponse.status()} - ${JSON.stringify(errorData)}`)
    }

    const loginData = await loginResponse.json()
    const { access, user } = loginData

    if (!access || !user) {
      throw new Error('Login response missing access token or user data')
    }

    console.log(`[global-setup] ✓ Logged in as ${user.email} (${user.role})`)

    // Отримати CSRF token
    const csrfResponse = await page.request.post(`${apiURL}/v1/auth/csrf`, {
      headers: {
        Authorization: `Bearer ${access}`
      }
    })

    const csrfData = await csrfResponse.json().catch(() => ({}))
    const csrfToken = csrfData.csrf_token || null

    // Зберегти auth state
    const authStateDir = path.join(__dirname, '.auth')
    if (!fs.existsSync(authStateDir)) {
      fs.mkdirSync(authStateDir, { recursive: true })
    }

    // v0.92.1: Генеруємо storageState з origins[].localStorage для гарантованого localStorage.access
    // Це забезпечує що Playwright тести матимуть access token перед першим API запитом
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: 'access', value: access },
            { name: 'user', value: JSON.stringify(user) }
          ]
        }
      ]
    }

    fs.writeFileSync(authStateFile, JSON.stringify(storageState, null, 2), 'utf-8')
    console.log(`[global-setup] ✓ Auth state saved to ${authStateFile} with localStorage.access`)

    // Зберегти credentials для швидкого доступу
    fs.writeFileSync(
      credentialsFile,
      JSON.stringify(
        {
          access,
          user,
          csrfToken,
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    )
    console.log(`[global-setup] ✓ Credentials saved`)

    // Step 2: Verify seed data via API (skip for dev-vertical)
    if (!skipCalendarSeed) {
      await verifySeedData(apiURL, access, user.id)
    } else {
      console.log('[global-setup] ✓ Skipping calendar sanity-check for dev-vertical')
    }

    console.log('[global-setup] ✅ Setup completed successfully')
  } catch (error) {
    console.error('[global-setup] ❌ Setup failed:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

export default globalSetup
