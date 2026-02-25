#!/usr/bin/env node
/**
 * Audit Script: Polling & Loader Problems Detector
 *
 * Шукає по всьому FE коду:
 * 1. setInterval без clearInterval — memory leaks
 * 2. loading = true без finally { loading = false } — нескінченні лодери
 * 3. polling у компонентах де є WS-альтернатива
 * 4. Компоненти які повністю перемонтуються при loading (layout shift)
 *
 * Usage: node scripts/audit-polling-loaders.mjs [--fix]
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative, extname } from 'path'

const SRC = join(process.cwd(), 'src')
const EXTS = new Set(['.vue', '.ts', '.js', '.tsx'])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (['node_modules', '.git', '__tests__', 'dist', 'coverage'].includes(name)) continue
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (EXTS.has(extname(name))) files.push(full)
  }
  return files
}

function rel(p) {
  return relative(process.cwd(), p).replace(/\\/g, '/')
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

const findings = []

function add(severity, category, file, line, message) {
  findings.push({ severity, category, file: rel(file), line, message })
}

// ─── Check 1: setInterval without clearInterval ─────────────────────────────

function checkIntervalLeak(filePath, content) {
  const sets = [...content.matchAll(/setInterval\s*\(/g)]
  const clears = (content.match(/clearInterval/g) || []).length

  // Only report if more sets than clears (potential leak)
  if (sets.length > clears) {
    sets.forEach(m => {
      const ln = lineOf(content, m.index)
      add('HIGH', 'INTERVAL_LEAK', filePath, ln,
        `setInterval (${sets.length}x) without enough clearInterval (${clears}x) — potential memory leak`)
    })
  }
}

// ─── Check 2: loading = true without finally ─────────────────────────────────

function checkLoadingNoFinally(filePath, content) {
  const patterns = [
    { re: /(\b\w*[Ll]oading\b)\.value\s*=\s*true/g, type: 'ref' },
    { re: /this\.(\w*[Ll]oading)\s*=\s*true/g, type: 'options' },
  ]

  for (const { re, type } of patterns) {
    let m
    while ((m = re.exec(content)) !== null) {
      const varName = m[1]
      const ln = lineOf(content, m.index)

      // Look ahead ~60 lines for finally + reset
      const ahead = content.slice(m.index).split('\n').slice(0, 60).join('\n')
      const hasFinally = /\bfinally\b/.test(ahead)
      const hasReset = type === 'ref'
        ? new RegExp(`${varName}\\.value\\s*=\\s*false`).test(ahead)
        : new RegExp(`this\\.${varName}\\s*=\\s*false`).test(ahead)

      if (!hasFinally || !hasReset) {
        add('CRITICAL', 'INFINITE_LOADER', filePath, ln,
          `"${m[0]}" — missing finally { ${varName}${type === 'ref' ? '.value' : ''} = false }. ` +
          `Loader will be infinite on error/exception.`)
      }
    }
  }
}

// ─── Check 3: polling where WS alternative exists ────────────────────────────

const WS_DOMAINS = {
  'inquiries': 'useInquiryWebSocket',
  'notifications': 'websocketService.subscribeNotifications',
  'chat': 'useChatWebSocket',
  'calendar': 'CalendarConsumer WS',
  'slots': 'subscribeTutorSlots',
  'booking': 'subscribeStudentBookings',
  'telegram': 'telegram.connected WS event',
}

function checkPollingInsteadOfWS(filePath, content) {
  const hasInterval = /setInterval/.test(content)
  if (!hasInterval) return

  // Skip pure utility/service files
  if (filePath.includes('pollingCoordinator') || filePath.includes('telemetry')) return
  // Skip non-domain files
  if (filePath.includes('Cursor') || filePath.includes('Laser') || filePath.includes('Presence')) return

  for (const [domain, wsAlternative] of Object.entries(WS_DOMAINS)) {
    const domainRe = new RegExp(domain, 'i')
    if (!domainRe.test(content)) continue

    // Has polling for this domain?
    const pollingMatches = [...content.matchAll(/setInterval\s*\(/g)]
    if (!pollingMatches.length) continue

    // Already uses WS?
    const wsRe = new RegExp(wsAlternative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const hasWS = wsRe.test(content) ||
      content.includes('useInquiryWebSocket') ||
      content.includes('realtimeService') ||
      content.includes('websocketService')

    if (!hasWS) {
      pollingMatches.forEach(m => {
        const ln = lineOf(content, m.index)
        add('HIGH', 'POLLING_INSTEAD_OF_WS', filePath, ln,
          `setInterval polling for "${domain}" domain — WS alternative available: ${wsAlternative}`)
      })
    }
  }
}

// ─── Check 4: layout shift — v-if on loading with full content replace ────────

function checkLayoutShift(filePath, content) {
  if (!filePath.endsWith('.vue')) return

  // Pattern: <LoadingState v-if="...loading..." /> followed by <div v-else or v-else-if
  // This completely unmounts and remounts content → CLS
  const fullReplaceRe = /<(?:LoadingState|div)[^>]*v-if[^>]*loading[^>]*>[\s\S]{0,200}<[^>]*v-else/g
  const matches = [...content.matchAll(fullReplaceRe)]

  matches.forEach(m => {
    const ln = lineOf(content, m.index)
    add('MEDIUM', 'LAYOUT_SHIFT', filePath, ln,
      'Full component replace on loading (v-if loading → v-else content). ' +
      'Use v-show or CSS opacity/skeleton instead to avoid CLS.')
  })
}

// ─── Check 5: parallel concurrent loading flags in one store ──────────────────

function checkConcurrentLoadingRace(filePath, content) {
  // Multiple isLoading = true in one store without guard (concurrent call overlap)
  const loadingStarts = [...content.matchAll(/isLoading(?:\.value)?\s*=\s*true/g)]
  if (loadingStarts.length < 2) return

  // If there's no "if (isLoading" guard — concurrent calls will reset each other
  const hasGuard = /if\s*\(\s*(?:this\.)?isLoading\b/.test(content) ||
                   /if\s*\(\s*isLoading\.value\b/.test(content)

  if (!hasGuard) {
    add('HIGH', 'CONCURRENT_LOADING_RACE', filePath, 1,
      `${loadingStarts.length} places set isLoading=true without concurrent call guard. ` +
      'Multiple simultaneous calls will corrupt loading state.')
  }
}

// ─── Check 6: v-if/v-show toggling high-frequency data ───────────────────────

function checkHighFrequencyRerender(filePath, content) {
  if (!filePath.endsWith('.vue')) return

  // Check if component subscribes to a fast-updating store + uses v-for or deep v-if
  const hasRealtimeData = content.includes('realtimeStore') ||
    content.includes('presenceStore') ||
    content.includes('boardStore')

  const hasDeepVFor = (content.match(/v-for=/g) || []).length > 3

  if (hasRealtimeData && hasDeepVFor) {
    add('MEDIUM', 'HIGH_FREQ_RERENDER', filePath, 1,
      'Component uses realtime/presence store + multiple v-for loops. ' +
      'Consider virtualizing lists or using shallowRef to prevent excessive re-renders.')
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const files = walk(SRC)
let scanned = 0

for (const file of files) {
  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  scanned++

  checkIntervalLeak(file, content)
  checkLoadingNoFinally(file, content)
  checkPollingInsteadOfWS(file, content)
  checkLayoutShift(file, content)
  checkConcurrentLoadingRace(file, content)
  checkHighFrequencyRerender(file, content)
}

// ─── Report ───────────────────────────────────────────────────────────────────

const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] }
for (const f of findings) {
  ;(bySeverity[f.severity] || bySeverity.LOW).push(f)
}

const SEVERITY_ICON = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '⚪' }

console.log('\n' + '═'.repeat(70))
console.log('  M4SH Frontend — Polling & Loader Audit Report')
console.log(`  Scanned: ${scanned} files  |  Issues: ${findings.length}`)
console.log('═'.repeat(70))

for (const [sev, items] of Object.entries(bySeverity)) {
  if (!items.length) continue
  console.log(`\n${SEVERITY_ICON[sev]} ${sev} (${items.length})\n`)

  // Group by category
  const byCategory = {}
  for (const item of items) {
    ;(byCategory[item.category] = byCategory[item.category] || []).push(item)
  }

  for (const [cat, catItems] of Object.entries(byCategory)) {
    console.log(`  ▸ ${cat}`)
    // Deduplicate by file+category to reduce noise
    const seen = new Set()
    for (const item of catItems) {
      const key = `${item.file}:${item.category}`
      if (seen.has(key)) continue
      seen.add(key)
      console.log(`    ${item.file}:${item.line}`)
      console.log(`    → ${item.message}\n`)
    }
  }
}

// ─── Summary table ────────────────────────────────────────────────────────────

console.log('═'.repeat(70))
console.log('  SUMMARY')
console.log('═'.repeat(70))
const categories = {}
for (const f of findings) {
  categories[f.category] = (categories[f.category] || 0) + 1
}
for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(30)} ${count} issue(s)`)
}
console.log('═'.repeat(70))

// ─── Save JSON report ─────────────────────────────────────────────────────────

const reportPath = join(process.cwd(), 'scripts', 'audit-report.json')
writeFileSync(reportPath, JSON.stringify({ scanned, findings }, null, 2))
console.log(`\n  Full JSON report: ${rel(reportPath)}\n`)

process.exit(findings.filter(f => f.severity === 'CRITICAL').length > 0 ? 1 : 0)
