/**
 * Lighthouse Audit Script для Calendar v0.68
 * Запускає аудит accessibility для desktop та mobile
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

const CALENDAR_URL = process.env.CALENDAR_URL || 'http://localhost:5173/tutor/calendar'
const OUTPUT_DIR = join(__dirname, '../lighthouse-reports')

// Створюємо директорію для звітів
try {
  mkdirSync(OUTPUT_DIR, { recursive: true })
} catch (err) {
  // Директорія вже існує
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

function buildDeviceFlags(device) {
  if (device === 'mobile') {
    return [
      '--form-factor=mobile',
      '--screenEmulation.mobile=true',
    ]
  }

  // Desktop: вимикаємо mobile-емуляцію та вимушуємо desktop form-factor
  return [
    '--form-factor=desktop',
    '--screenEmulation.disabled',
  ]
}

async function runLighthouse(device = 'desktop') {
  console.log(`\n🔍 Running Lighthouse audit for ${device}...`)
  
  const basePath = join(OUTPUT_DIR, `calendar-${device}-${timestamp}`)
  const jsonPath = `${basePath}.report.json`
  const htmlPath = `${basePath}.report.html`
  
  const deviceFlags = buildDeviceFlags(device).join(' ')
  
  const command = `npx lighthouse ${CALENDAR_URL} \
    ${deviceFlags} \
    --only-categories=accessibility,performance,best-practices \
    --output=json,html \
    --output-path=${basePath} \
    --chrome-flags="--headless --no-sandbox --disable-gpu"`
  
  try {
    const { stdout, stderr } = await execAsync(command)
    
    if (stderr && !stderr.includes('Chrome')) {
      console.warn('⚠️  Warnings:', stderr)
    }
    
    console.log(`✅ ${device} audit completed`)
    console.log(`   JSON: ${jsonPath}`)
    console.log(`   HTML: ${htmlPath}`)
    
    // Читаємо результати
    const results = JSON.parse(await import('fs').then(fs =>
      fs.promises.readFile(jsonPath, 'utf-8')
    ))
    
    return {
      device,
      scores: {
        accessibility: results.categories.accessibility.score * 100,
        performance: results.categories.performance.score * 100,
        bestPractices: results.categories['best-practices'].score * 100,
      },
      audits: results.audits,
    }
  } catch (error) {
    console.error(`❌ Error running ${device} audit:`, error.message)
    return null
  }
}

async function generateSummary(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    url: CALENDAR_URL,
    results: results.filter(r => r !== null),
  }
  
  const summaryPath = join(OUTPUT_DIR, `summary-${timestamp}.json`)
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  
  console.log('\n📊 Audit Summary:')
  console.log('='.repeat(50))
  
  for (const result of summary.results) {
    console.log(`\n${result.device.toUpperCase()}:`)
    console.log(`  Accessibility: ${result.scores.accessibility.toFixed(1)}%`)
    console.log(`  Performance:   ${result.scores.performance.toFixed(1)}%`)
    console.log(`  Best Practices: ${result.scores.bestPractices.toFixed(1)}%`)
  }
  
  console.log('\n' + '='.repeat(50))
  console.log(`📁 Summary saved to: ${summaryPath}`)
  
  // Перевірка DoD критеріїв
  const failedChecks = []
  
  for (const result of summary.results) {
    if (result.scores.accessibility < 90) {
      failedChecks.push(`${result.device} accessibility score < 90%`)
    }
  }
  
  if (failedChecks.length > 0) {
    console.log('\n⚠️  DoD Criteria NOT MET:')
    failedChecks.forEach(check => console.log(`   - ${check}`))
    process.exit(1)
  } else {
    console.log('\n✅ All DoD criteria met!')
  }
}

async function main() {
  console.log('🚀 Starting Lighthouse Audit for Calendar v0.68')
  console.log(`📍 Target URL: ${CALENDAR_URL}`)
  
  const results = await Promise.all([
    runLighthouse('desktop'),
    runLighthouse('mobile'),
  ])
  
  await generateSummary(results)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
