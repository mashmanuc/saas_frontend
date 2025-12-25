/**
 * Playwright Global Setup
 * Виконується один раз перед усіма тестами
 */

import { chromium, FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalSetup(config: FullConfig) {
  console.log('[global-setup] Starting...')

  const authStateFile = path.join(__dirname, '.auth/user.json')
  const credentialsFile = path.join(__dirname, '.auth/credentials.json')

  // Перевірити чи є збережений auth state
  if (fs.existsSync(authStateFile) && fs.existsSync(credentialsFile)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'))
      const timestamp = new Date(credentials.timestamp)
      const hoursSinceAuth = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60)

      // Якщо auth state свіжий (менше 1 години), використовуємо його
      if (hoursSinceAuth < 1) {
        console.log('[global-setup] ✓ Using existing auth state')
        return
      }
      console.log('[global-setup] Auth state is stale, re-authenticating...')
    } catch (error) {
      console.log('[global-setup] Failed to read auth state, re-authenticating...')
    }
  }

  // Якщо немає auth state або він застарів, виконуємо логін
  console.log('[global-setup] Authenticating test user...')

  const baseURL = config.projects[0].use.baseURL || 'http://127.0.0.1:4173'
  const apiURL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

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

    // Зберегти storage state для Playwright
    await context.storageState({ path: authStateFile })
    console.log(`[global-setup] ✓ Auth state saved to ${authStateFile}`)

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
