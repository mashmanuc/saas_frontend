#!/usr/bin/env node
/**
 * Bootstrap Calendar Lessons
 * Створює тестові уроки для E2E тестів з гарантованими майбутніми датами
 * та статусами unpaid/scheduled для можливості редагування/видалення.
 * 
 * Usage:
 *   node bootstrap-calendar-lessons.js           # Створити нові уроки
 *   node bootstrap-calendar-lessons.js --clean   # Видалити старі тестові уроки перед створенням
 */

import fs from 'fs'
import path from 'path'
import axios from 'axios'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const AUTH_STATE_DIR = path.join(__dirname, '../tests/e2e/.auth')
const CREDENTIALS_FILE = path.join(AUTH_STATE_DIR, 'credentials.json')

const DEFAULT_TZ = 'Europe/Kiev'
const CLEAN_MODE = process.argv.includes('--clean')

async function main() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.error('[bootstrap-calendar-lessons] Credentials file not found. Run `npm run bootstrap-auth` first.')
    process.exit(1)
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'))
  const accessToken = credentials?.access
  const tutor = credentials?.user

  if (!accessToken || !tutor) {
    console.error('[bootstrap-calendar-lessons] Missing access token or user in credentials file.')
    process.exit(1)
  }

  if (tutor.role !== 'tutor') {
    console.error(`[bootstrap-calendar-lessons] User ${tutor.email} is not a tutor. Cannot seed lessons.`)
    process.exit(1)
  }

  dayjs.extend(utc)
  dayjs.extend(timezone)

  const tutorId = tutor.id
  const weekStartParam = process.env.CALENDAR_WEEK_START || dayjs().format('YYYY-MM-DD')

  console.log('[bootstrap-calendar-lessons] Fetching calendar snapshot...', { tutorId, weekStartParam })

  const snapshotRes = await axios.get(`${API_BASE_URL}/v1/calendar/week/v055/`, {
    params: {
      tutorId,
      weekStart: weekStartParam,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const snapshot = snapshotRes.data
  if (!snapshot) {
    console.error('[bootstrap-calendar-lessons] Snapshot response is empty')
    process.exit(1)
  }

  const weekStart = snapshot?.meta?.weekStart || weekStartParam
  const timezoneName = snapshot?.meta?.timezone || DEFAULT_TZ
  const orders = snapshot?.orders || []

  if (!orders.length) {
    console.error('[bootstrap-calendar-lessons] No orders available for tutor. Cannot create lessons without orderId.')
    process.exit(1)
  }

  const orderId = orders[0]?.id
  if (!orderId) {
    console.error('[bootstrap-calendar-lessons] First order does not contain id.')
    process.exit(1)
  }

  // Clean old test lessons if --clean flag provided
  if (CLEAN_MODE) {
    console.log('[bootstrap-calendar-lessons] Cleaning old test lessons...')
    // Видаляємо конкретні ID уроків, які були створені раніше (64-67)
    const knownTestEventIds = [64, 65, 66, 67, 29, 62, 63]
    
    console.log(`[bootstrap-calendar-lessons] Attempting to delete known test event IDs: ${knownTestEventIds.join(', ')}`)
    
    for (const eventId of knownTestEventIds) {
      try {
        await axios.post(`${API_BASE_URL}/v1/calendar/event/delete/`, 
          { id: eventId },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        console.log(`  ✓ Deleted test event ${eventId}`)
        // Затримка для уникнення rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message
        if (!errorMsg.includes('not found') && !errorMsg.includes('Event not found')) {
          console.log(`  ✗ Failed to delete event ${eventId}:`, errorMsg)
        }
      }
    }
  }

  const baseWeekStart = dayjs.tz(weekStart, timezoneName)
  const now = dayjs()

  // Створюємо уроки мінімум через 2 дні від поточної дати для гарантії майбутнього статусу
  const minDaysAhead = 2
  const slotsToCreate = [
    { offsetDays: minDaysAhead + 1, hour: 14, minute: 30, duration: 60 },
    { offsetDays: minDaysAhead + 2, hour: 15, minute: 0, duration: 60 },
    { offsetDays: minDaysAhead + 3, hour: 16, minute: 30, duration: 90 },
    { offsetDays: minDaysAhead + 4, hour: 13, minute: 0, duration: 60 },
  ]

  console.log('[bootstrap-calendar-lessons] Using orderId', orderId)
  console.log('[bootstrap-calendar-lessons] Creating lessons at least', minDaysAhead, 'days ahead')

  for (const slot of slotsToCreate) {
    // Завжди створюємо уроки від сьогодні + offsetDays (не від weekStart)
    let start = now.add(slot.offsetDays, 'day').hour(slot.hour).minute(slot.minute || 0).second(0).millisecond(0)
    
    // Додаткова перевірка: якщо все ще в минулому, додаємо ще тиждень
    while (start.isBefore(now.add(1, 'hour'))) {
      start = start.add(7, 'day')
    }

    const payload = {
      orderId,
      start: start.toISOString(),
      durationMin: slot.duration,
      tutorComment: 'Seeded via bootstrap-calendar-lessons.js',
      notifyStudent: false,
      autoGenerateZoom: true,
      timezone: timezoneName,
    }

    console.log('[bootstrap-calendar-lessons] Creating event', payload)

    try {
      const res = await axios.post(`${API_BASE_URL}/v1/calendar/event/create/`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      console.log('  ✓ Created event', res.data?.data?.id || res.data?.id || res.data)
      // Затримка для уникнення rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error('  ✗ Failed to create event', error.response?.data || error.message)
    }
  }

  console.log('[bootstrap-calendar-lessons] Done. Refresh /calendar and rerun Playwright tests.')
}

main().catch(err => {
  console.error('[bootstrap-calendar-lessons] Unexpected error:', err)
  process.exit(1)
})
