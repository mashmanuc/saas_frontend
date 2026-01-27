/**
 * Playwright Global Setup for Staff Tests
 * Creates separate auth state for staff user
 */

import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalSetupStaff() {
  console.log('[global-setup-staff] Authenticating staff user...')

  const authStateFile = path.join(__dirname, '.auth/staff.json')
  const credentialsFile = path.join(__dirname, '.auth/staff-credentials.json')
  const apiURL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Login via API
    const loginResponse = await page.request.post(`${apiURL}/v1/auth/login`, {
      data: {
        email: 'e2e-staff@example.com',
        password: 'demo1234'
      }
    })

    if (!loginResponse.ok()) {
      throw new Error(`Staff login failed: ${loginResponse.status()}`)
    }

    const loginData = await loginResponse.json()
    console.log('[global-setup-staff] ✓ Logged in as e2e-staff@example.com')

    // Save auth state
    await context.storageState({ path: authStateFile })
    console.log('[global-setup-staff] ✓ Auth state saved to', authStateFile)

    // Save credentials
    const credentials = {
      email: 'e2e-staff@example.com',
      access: loginData.access,
      user: loginData.user,
      timestamp: new Date().toISOString()
    }
    fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2))
    console.log('[global-setup-staff] ✓ Credentials saved')

  } catch (error: any) {
    console.error('[global-setup-staff] ❌ Failed:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetupStaff
