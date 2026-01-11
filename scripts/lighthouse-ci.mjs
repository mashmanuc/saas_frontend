/**
 * Lighthouse CI Script для автоматичної перевірки accessibility
 * 
 * Використання:
 *   node scripts/lighthouse-ci.mjs --output=json --chrome-flags="--headless"
 * 
 * Exit codes:
 *   0 - Accessibility score >= 95%
 *   1 - Accessibility score < 95%
 *   2 - Error during execution
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Configuration
const CALENDAR_URL = process.env.CALENDAR_URL || 'http://localhost:5173/tutor/calendar'
const OUTPUT_DIR = join(__dirname, '../test-results/lighthouse')
const MIN_ACCESSIBILITY_SCORE = 0.95 // 95%

// Parse CLI arguments
const args = process.argv.slice(2)
const outputFormat = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'json'
const chromeFlags = args.find(arg => arg.startsWith('--chrome-flags='))?.split('=')[1] || '--headless'

// Create output directory
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

async function runLighthouse() {
  console.log('🔍 Starting Lighthouse CI audit...')
  console.log(`📍 Target URL: ${CALENDAR_URL}`)
  console.log(`🎯 Min accessibility score: ${MIN_ACCESSIBILITY_SCORE * 100}%`)
  
  const outputPath = join(OUTPUT_DIR, `lighthouse-ci-${timestamp}`)
  
  const command = `npx lighthouse ${CALENDAR_URL} \
    --only-categories=accessibility \
    --output=${outputFormat} \
    --output-path=${outputPath} \
    --chrome-flags="${chromeFlags}" \
    --quiet`
  
  try {
    console.log('\n⏳ Running Lighthouse audit...')
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    })
    
    if (stderr && !stderr.includes('Chrome')) {
      console.warn('⚠️  Warnings:', stderr)
    }
    
    // Read results
    const resultsPath = `${outputPath}.json`
    const results = JSON.parse(
      await import('fs').then(fs => fs.promises.readFile(resultsPath, 'utf-8'))
    )
    
    const accessibilityScore = results.categories.accessibility.score
    const scorePercent = (accessibilityScore * 100).toFixed(1)
    
    console.log('\n📊 Results:')
    console.log(`   Accessibility Score: ${scorePercent}%`)
    console.log(`   Threshold: ${MIN_ACCESSIBILITY_SCORE * 100}%`)
    
    // Extract failed audits
    const failedAudits = []
    for (const [auditId, audit] of Object.entries(results.audits)) {
      if (audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'notApplicable') {
        failedAudits.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score
        })
      }
    }
    
    // Save summary
    const summary = {
      timestamp: new Date().toISOString(),
      url: CALENDAR_URL,
      accessibilityScore: accessibilityScore,
      passed: accessibilityScore >= MIN_ACCESSIBILITY_SCORE,
      threshold: MIN_ACCESSIBILITY_SCORE,
      failedAudits: failedAudits,
      reportPath: resultsPath
    }
    
    const summaryPath = join(OUTPUT_DIR, `summary-${timestamp}.json`)
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
    
    console.log(`\n📁 Report saved to: ${resultsPath}`)
    console.log(`📁 Summary saved to: ${summaryPath}`)
    
    // Check if passed
    if (accessibilityScore >= MIN_ACCESSIBILITY_SCORE) {
      console.log('\n✅ Accessibility check PASSED')
      return 0
    } else {
      console.error('\n❌ Accessibility check FAILED')
      console.error(`   Score ${scorePercent}% is below threshold ${MIN_ACCESSIBILITY_SCORE * 100}%`)
      
      if (failedAudits.length > 0) {
        console.error('\n❌ Failed audits:')
        failedAudits.slice(0, 5).forEach(audit => {
          console.error(`   - ${audit.title} (score: ${(audit.score * 100).toFixed(0)}%)`)
        })
        if (failedAudits.length > 5) {
          console.error(`   ... and ${failedAudits.length - 5} more`)
        }
      }
      
      return 1
    }
    
  } catch (error) {
    console.error('\n❌ Error running Lighthouse:', error.message)
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Hint: Make sure the dev server is running:')
      console.error('   npm run dev')
    }
    
    return 2
  }
}

// Main execution
runLighthouse()
  .then(exitCode => {
    process.exit(exitCode)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(2)
  })
