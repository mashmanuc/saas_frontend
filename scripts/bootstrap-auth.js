#!/usr/bin/env node
/**
 * Bootstrap Auth Script for E2E Tests
 * Автоматично логінить тестового користувача та зберігає auth state
 */

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'm3@gmail.com'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'demo1234'

const AUTH_STATE_DIR = path.join(__dirname, '../tests/e2e/.auth')
const AUTH_STATE_FILE = path.join(AUTH_STATE_DIR, 'user.json')

async function bootstrapAuth() {
  console.log('[bootstrap-auth] Starting authentication...')
  console.log(`[bootstrap-auth] API: ${API_BASE_URL}`)
  console.log(`[bootstrap-auth] User: ${TEST_USER_EMAIL}`)

  try {
    // 1. Перевірка health
    console.log('[bootstrap-auth] Checking backend health...')
    const healthRes = await axios.get(`${API_BASE_URL}/health/`, {
      timeout: 5000,
      validateStatus: () => true
    })
    
    if (healthRes.status !== 200) {
      throw new Error(`Backend health check failed: ${healthRes.status}`)
    }
    console.log('[bootstrap-auth] ✓ Backend is healthy')

    // 2. Login
    console.log('[bootstrap-auth] Logging in...')
    const loginRes = await axios.post(
      `${API_BASE_URL}/v1/auth/login`,
      {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      },
      {
        withCredentials: true,
        timeout: 10000,
        validateStatus: () => true
      }
    )

    if (loginRes.status !== 200) {
      console.error('[bootstrap-auth] Login failed:', loginRes.data)
      throw new Error(`Login failed with status ${loginRes.status}`)
    }

    const { access, user } = loginRes.data

    if (!access || !user) {
      throw new Error('Login response missing access token or user data')
    }

    console.log('[bootstrap-auth] ✓ Login successful')
    console.log(`[bootstrap-auth] User: ${user.email} (${user.role})`)

    // 3. Get CSRF token
    console.log('[bootstrap-auth] Fetching CSRF token...')
    const csrfRes = await axios.post(
      `${API_BASE_URL}/v1/auth/csrf`,
      {},
      {
        headers: {
          Authorization: `Bearer ${access}`
        },
        withCredentials: true,
        timeout: 5000,
        validateStatus: () => true
      }
    )

    const csrfToken = csrfRes.data?.csrf_token || null
    console.log('[bootstrap-auth] ✓ CSRF token obtained')

    // 4. Створити auth state для Playwright
    if (!fs.existsSync(AUTH_STATE_DIR)) {
      fs.mkdirSync(AUTH_STATE_DIR, { recursive: true })
    }

    const testOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173'
    ]

    const authState = {
      cookies: [],
      origins: testOrigins.map(origin => ({
        origin,
        localStorage: [
          {
            name: 'access',
            value: access
          },
          {
            name: 'user',
            value: JSON.stringify(user)
          }
        ]
      }))
    }

    // Додати cookies якщо є
    if (loginRes.headers['set-cookie']) {
      const cookies = Array.isArray(loginRes.headers['set-cookie'])
        ? loginRes.headers['set-cookie']
        : [loginRes.headers['set-cookie']]

      cookies.forEach(cookieStr => {
        const [nameValue, ...attrs] = cookieStr.split(';')
        const [name, value] = nameValue.split('=')
        
        authState.cookies.push({
          name: name.trim(),
          value: value.trim(),
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: attrs.some(a => a.trim().toLowerCase() === 'httponly'),
          secure: attrs.some(a => a.trim().toLowerCase() === 'secure'),
          sameSite: 'Lax'
        })
      })
    }

    fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(authState, null, 2))
    console.log(`[bootstrap-auth] ✓ Auth state saved to ${AUTH_STATE_FILE}`)

    // 5. Також зберегти у простий JSON для швидкого доступу
    const simpleAuthFile = path.join(AUTH_STATE_DIR, 'credentials.json')
    fs.writeFileSync(
      simpleAuthFile,
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
    console.log(`[bootstrap-auth] ✓ Credentials saved to ${simpleAuthFile}`)

    console.log('[bootstrap-auth] ✅ Bootstrap completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('[bootstrap-auth] ❌ Error:', error.message)
    if (error.response) {
      console.error('[bootstrap-auth] Response:', error.response.data)
    }
    process.exit(1)
  }
}

bootstrapAuth()
