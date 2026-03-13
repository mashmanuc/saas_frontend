// scripts/migrate-boards-to-lessons.ts
// Запуск: AUTH_TOKEN=xxx npx tsx scripts/migrate-boards-to-lessons.ts [--dry-run]
//
// УВАГА: Цей скрипт — ТІЛЬКИ для аналізу та ручної перевірки.
// Реальна прив'язка Lesson ↔ WBSession робиться на backend через apps/lessons/ API.
// Скрипт генерує звіт: які сесії вже мають lesson, які — ні.
//
// Ref: DAY20_AGENT-A.md A14

const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const DRY_RUN = process.argv.includes('--dry-run')

interface Session {
  id: string
  title?: string
  created_at: string
  lesson?: { id: number; name: string } | null
}

interface Report {
  total: number
  withLesson: number
  withoutLesson: number
  sessions: Array<{ id: string; hasLesson: boolean; lessonId?: number }>
}

async function fetchAllSessions(token: string): Promise<Session[]> {
  const sessions: Session[] = []
  let offset = 0
  const limit = 50

  while (true) {
    const url = `${BASE_URL}/winterboard/sessions/?limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)

    const data = await res.json()
    const results: Session[] = data.results ?? data

    if (results.length === 0) break
    sessions.push(...results)

    if (!data.next) break
    offset += limit
  }

  return sessions
}

async function generateReport(sessions: Session[]): Promise<Report> {
  const report: Report = {
    total: sessions.length,
    withLesson: 0,
    withoutLesson: 0,
    sessions: [],
  }

  for (const session of sessions) {
    const hasLesson = !!session.lesson
    if (hasLesson) {
      report.withLesson++
    } else {
      report.withoutLesson++
    }
    report.sessions.push({
      id: session.id,
      hasLesson,
      lessonId: session.lesson?.id,
    })
  }

  return report
}

async function main() {
  const token = process.env.AUTH_TOKEN
  if (!token) {
    console.error('ERROR: AUTH_TOKEN env variable required')
    console.error('Usage: AUTH_TOKEN=xxx npx tsx scripts/migrate-boards-to-lessons.ts [--dry-run]')
    process.exit(1)
  }

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'REPORT ONLY'}`)
  console.log(`API: ${BASE_URL}`)
  console.log('---')

  try {
    const sessions = await fetchAllSessions(token)
    const report = await generateReport(sessions)

    console.log(`Total sessions: ${report.total}`)
    console.log(`With lesson:    ${report.withLesson}`)
    console.log(`Without lesson: ${report.withoutLesson}`)
    console.log('')

    if (report.withoutLesson > 0) {
      console.log('Sessions WITHOUT lesson (need manual action):')
      report.sessions
        .filter(s => !s.hasLesson)
        .forEach(s => console.log(`  - Session ${s.id}`))
      console.log('')
      console.log('NOTE: To link a session to a lesson, use:')
      console.log('  POST /api/v1/lessons/{lessonId}/start/ with {"session_id": "..."}')
      console.log('  OR create lessons through the UI and start them from there.')
    } else {
      console.log('All sessions have lessons. No migration needed.')
    }

    const fs = await import('fs')
    const reportPath = `scripts/migration-report-${Date.now()}.json`
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nReport saved to: ${reportPath}`)

  } catch (e) {
    console.error('Migration script failed:', e)
    process.exit(1)
  }
}

main()
