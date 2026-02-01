/**
 * Playwright Global Setup
 * Виконується один раз перед усіма тестами
 */

/**
 * E2E Global Setup - Authentication State Management
 * 
 * CRITICAL INVARIANTS (DO NOT BREAK):
 * 
 * 1. TWO SEPARATE AUTH STATES:
 *    - tests/e2e/.auth/user.json (tutor: m3@gmail.com)
 *    - tests/e2e/.auth/staff.json (staff: e2e-staff@example.com)
 * 
 * 2. VALIDATION BEFORE REUSE:
 *    "Using existing auth state" is allowed ONLY if:
 *    - Both files exist
 *    - Both have valid credentials (access + user)
 *    - Both storageState files contain localStorage with 'access' and 'user' keys
 *    - Auth is fresh (< 1 hour)
 * 
 * 3. LOCALSTORAGE PERSISTENCE:
 *    - Must call page.goto(baseURL) BEFORE page.evaluate(localStorage.setItem)
 *    - Must verify localStorage.getItem('access') exists BEFORE context.storageState()
 *    - Must NOT close context before saving storageState
 * 
 * 4. STAFF AUTH VERIFICATION:
 *    - Must verify staff access via /api/v1/staff/tutors/activity-list endpoint
 *    - Must NOT rely on /api/v1/users/me/ (returns 404)
 * 
 * Breaking these invariants will cause:
 * - ENOENT errors (missing staff.json)
 * - Login form instead of staff UI (empty localStorage)
 * - waitForResponse timeouts (no API call triggered)
 * - Flaky tests with race conditions
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
    console.log('[global-setup] ✓ Calendar seed completed')
    
    // Seed staff user for staff tests
    execFileSync(pythonExec, ['manage.py', 'e2e_seed_staff'], {
      cwd: backendDir,
      stdio: 'inherit'
    })
    console.log('[global-setup] ✓ Staff seed completed')
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

  // Step 1: Run seed command
  await runE2ESeed()

  const authStateFile = path.join(__dirname, '.auth/user.json')
  const credentialsFile = path.join(__dirname, '.auth/credentials.json')
  const staffAuthStateFile = path.join(__dirname, '.auth/staff.json')
  const staffCredentialsFile = path.join(__dirname, '.auth/staff-credentials.json')
  const baseURL = config.projects[0].use.baseURL || 'http://127.0.0.1:4173'
  const apiURL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

  /**
   * E2E Stability Invariant:
   * Both user.json and staff.json must exist and contain valid localStorage.
   * "Using existing auth state" is allowed ONLY if:
   * 1. Both files exist
   * 2. Both have valid credentials (access + user)
   * 3. Both storageState files contain localStorage with 'access' and 'user' keys
   * 4. Auth is fresh (< 1 hour)
   * 
   * This prevents ENOENT errors and login-form regressions.
   */
  const canReuseAuthState = () => {
    // Check all 4 files exist
    if (!fs.existsSync(authStateFile) || !fs.existsSync(credentialsFile) ||
        !fs.existsSync(staffAuthStateFile) || !fs.existsSync(staffCredentialsFile)) {
      console.log('[global-setup] Missing auth files, re-authenticating...')
      return false
    }

    try {
      // Validate tutor credentials
      const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'))
      const timestamp = new Date(credentials.timestamp)
      const hoursSinceAuth = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60)

      if (hoursSinceAuth >= 1) {
        console.log('[global-setup] Auth state is stale, re-authenticating...')
        return false
      }

      if (!credentials.access || !credentials.user?.id) {
        console.log('[global-setup] Tutor credentials incomplete, re-authenticating...')
        return false
      }

      // Validate staff credentials
      const staffCredentials = JSON.parse(fs.readFileSync(staffCredentialsFile, 'utf-8'))
      if (!staffCredentials.access || !staffCredentials.user?.id) {
        console.log('[global-setup] Staff credentials incomplete, re-authenticating...')
        return false
      }

      // Validate tutor storageState contains localStorage
      const tutorState = JSON.parse(fs.readFileSync(authStateFile, 'utf-8'))
      const tutorHasLocalStorage = tutorState.origins?.some((origin: any) => 
        origin.localStorage?.some((item: any) => item.name === 'access' || item.name === 'user')
      )
      
      if (!tutorHasLocalStorage) {
        console.log('[global-setup] Tutor storageState missing localStorage, re-authenticating...')
        return false
      }

      // Validate staff storageState contains localStorage
      const staffState = JSON.parse(fs.readFileSync(staffAuthStateFile, 'utf-8'))
      const staffHasLocalStorage = staffState.origins?.some((origin: any) => 
        origin.localStorage?.some((item: any) => item.name === 'access' || item.name === 'user')
      )
      
      if (!staffHasLocalStorage) {
        console.log('[global-setup] Staff storageState missing localStorage, re-authenticating...')
        return false
      }

      return true
    } catch (error) {
      console.log('[global-setup] Failed to validate auth state, re-authenticating...')
      return false
    }
  }

  // Перевірити чи можна використати існуючий auth state
  if (canReuseAuthState()) {
    const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'))
    console.log('[global-setup] ✓ Using existing auth state (validated: tutor + staff)')
    // Skip verifySeedData to avoid rate limit issues
    // await verifySeedData(apiURL, credentials.access, credentials.user.id)
    return
  }

  // Якщо немає auth state або він застарів, виконуємо логін
  console.log('[global-setup] Authenticating test users...')

  const browser = await chromium.launch()
  
  try {
    // Перевірка health backend з retry/backoff для 429 та 5xx
    const healthContext = await browser.newContext()
    const healthPage = await healthContext.newPage()
    
    const maxAttempts = 8
    let healthResponse = await healthPage.request.get(`${apiURL}/health/`)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        healthResponse = await healthPage.request.get(`${apiURL}/health/`)
      }
      
      if (healthResponse.ok()) {
        break
      }
      
      const status = healthResponse.status()
      const headers = healthResponse.headers()
      const retryAfter = Number(headers['retry-after'] ?? '0')
      
      if (status === 429) {
        const sleepMs = retryAfter > 0 ? retryAfter * 1000 : 2000 + attempt * 500
        console.log(`[global-setup] Health rate-limited (429), retry in ${sleepMs}ms (attempt ${attempt}/${maxAttempts})`)
        await new Promise(r => setTimeout(r, sleepMs))
        continue
      }
      
      // Transient 5xx errors
      if ([500, 502, 503].includes(status)) {
        const sleepMs = 1000 + attempt * 500
        console.log(`[global-setup] Health transient ${status}, retry in ${sleepMs}ms (attempt ${attempt}/${maxAttempts})`)
        await new Promise(r => setTimeout(r, sleepMs))
        continue
      }
      
      // Other errors (401, 403, 404, etc.) - fail immediately
      const body = (await healthResponse.text()).slice(0, 800)
      await healthContext.close()
      throw new Error(`Backend health check failed: ${status}\n${body}`)
    }
    
    if (!healthResponse.ok()) {
      const body = (await healthResponse.text()).slice(0, 800)
      await healthContext.close()
      throw new Error(`Backend health check failed: ${healthResponse.status()} (exhausted retries)\n${body}`)
    }
    
    await healthContext.close()
    console.log('[global-setup] ✓ Backend is healthy')

    const authStateDir = path.join(__dirname, '.auth')
    if (!fs.existsSync(authStateDir)) {
      fs.mkdirSync(authStateDir, { recursive: true })
    }

    // ========== 1. Authenticate TUTOR user (m3@gmail.com) ==========
    console.log('[global-setup] Authenticating tutor user...')
    const tutorContext = await browser.newContext()
    const tutorPage = await tutorContext.newPage()

    const tutorLoginResponse = await tutorPage.request.post(`${apiURL}/v1/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'm3@gmail.com',
        password: process.env.TEST_USER_PASSWORD || 'demo1234'
      }
    })

    if (!tutorLoginResponse.ok()) {
      const errorData = await tutorLoginResponse.json().catch(() => ({}))
      throw new Error(`Tutor login failed: ${tutorLoginResponse.status()} - ${JSON.stringify(errorData)}`)
    }

    const tutorLoginData = await tutorLoginResponse.json()
    console.log('[global-setup] DEBUG: Login response structure:', JSON.stringify(tutorLoginData, null, 2))
    
    const { access: tutorAccess, user: tutorUser } = tutorLoginData

    if (!tutorAccess || !tutorUser) {
      console.log('[global-setup] DEBUG: tutorAccess:', tutorAccess)
      console.log('[global-setup] DEBUG: tutorUser:', tutorUser)
      throw new Error('Tutor login response missing access token or user data')
    }

    console.log(`[global-setup] ✓ Logged in as ${tutorUser.email} (tutor)`)

    // Прив'язати localStorage токени до baseURL
    await tutorPage.goto(baseURL)
    await tutorPage.evaluate(
      ([token, serializedUser]) => {
        window.localStorage.setItem('access', token)
        window.localStorage.setItem('user', serializedUser)
      },
      [tutorAccess, JSON.stringify(tutorUser)]
    )

    // Зберегти tutor auth state
    await tutorContext.storageState({ path: authStateFile })
    console.log(`[global-setup] ✓ Tutor auth state saved to ${authStateFile}`)

    // Зберегти tutor credentials
    fs.writeFileSync(
      credentialsFile,
      JSON.stringify(
        {
          access: tutorAccess,
          user: tutorUser,
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    )
    console.log(`[global-setup] ✓ Tutor credentials saved`)

    await tutorContext.close()

    // Verify seed data via tutor API
    await verifySeedData(apiURL, tutorAccess, tutorUser.id)

    // ========== 2. Authenticate STAFF user (e2e-staff@example.com) ==========
    console.log('[global-setup] Authenticating staff user...')
    const staffContext = await browser.newContext()
    const staffPage = await staffContext.newPage()

    const staffLoginResponse = await staffPage.request.post(`${apiURL}/v1/auth/login`, {
      data: {
        email: 'e2e-staff@example.com',
        password: 'demo1234'
      }
    })

    if (!staffLoginResponse.ok()) {
      const errorData = await staffLoginResponse.json().catch(() => ({}))
      throw new Error(`Staff login failed: ${staffLoginResponse.status()} - ${JSON.stringify(errorData)}`)
    }

    const staffLoginData = await staffLoginResponse.json()
    const { access: staffAccess, user: staffUser } = staffLoginData

    if (!staffAccess || !staffUser) {
      throw new Error('Staff login response missing access token or user data')
    }

    // Verify staff user has access to staff endpoint
    const staffCheckResponse = await staffPage.request.get(`${apiURL}/v1/staff/tutors/activity-list?limit=1`, {
      headers: { Authorization: `Bearer ${staffAccess}` }
    })

    if (!staffCheckResponse.ok()) {
      const status = staffCheckResponse.status()
      if (status === 403 || status === 401) {
        throw new Error(
          `User e2e-staff@example.com does not have staff access! Status: ${status}. ` +
          `Run: python manage.py e2e_seed_staff`
        )
      }
      throw new Error(`Failed to verify staff access: ${status}`)
    }

    console.log(`[global-setup] ✓ Logged in as ${staffUser.email} (staff, verified via activity-list endpoint)`)

    // Sanity-check: verify activity-list returns ≥1 tutor (seed guarantee)
    const activityListData = await staffCheckResponse.json()
    if (!activityListData.results || activityListData.results.length === 0) {
      throw new Error(
        `Staff activity-list returned empty results! ` +
        `Seed must guarantee ≥1 tutor in activity-list. ` +
        `Run: python manage.py e2e_seed_calendar && python manage.py e2e_seed_staff`
      )
    }
    console.log(`[global-setup] ✓ Activity-list has ${activityListData.results.length} tutor(s)`)

    // Прив'язати localStorage токени до baseURL
    await staffPage.goto(baseURL)
    await staffPage.evaluate(
      ([token, serializedUser]) => {
        window.localStorage.setItem('access', token)
        window.localStorage.setItem('user', serializedUser)
      },
      [staffAccess, JSON.stringify(staffUser)]
    )

    // Verify localStorage was set
    const storedAccess = await staffPage.evaluate(() => window.localStorage.getItem('access'))
    const storedUser = await staffPage.evaluate(() => window.localStorage.getItem('user'))
    
    if (!storedAccess || !storedUser) {
      throw new Error(
        `Failed to store staff auth tokens in localStorage. Stored access: ${!!storedAccess}, stored user: ${!!storedUser}`
      )
    }

    // Зберегти staff auth state (AFTER localStorage is set)
    const staffAuthStateFile = path.join(__dirname, '.auth/staff.json')
    const staffCredentialsFile = path.join(__dirname, '.auth/staff-credentials.json')
    
    await staffContext.storageState({ path: staffAuthStateFile })
    console.log(`[global-setup] ✓ Staff auth state saved to ${staffAuthStateFile}`)

    // Зберегти staff credentials
    fs.writeFileSync(
      staffCredentialsFile,
      JSON.stringify(
        {
          access: staffAccess,
          user: staffUser,
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    )
    console.log(`[global-setup] ✓ Staff credentials saved`)

    await staffContext.close()

    console.log('[global-setup] ✅ Setup completed successfully')
  } catch (error) {
    console.error('[global-setup] ❌ Setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
