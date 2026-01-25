#!/usr/bin/env node
/**
 * CI Gate: Check for raw axios imports
 * v0.86.3 - API Client Auth Invariants
 * 
 * Ensures all HTTP requests go through apiClient, not raw axios.
 * Allowlist: apiClient.js, rethrowAsDomainError.ts, relationsStore.ts, staffStore.ts
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

const ALLOWLIST = [
  'src/utils/apiClient.js',
  'src/utils/rethrowAsDomainError.ts'
]

console.log('🔍 Checking for raw axios imports...\n')

try {
  // Search for "import axios" or "from 'axios'" in src/
  const result = execSync(
    `git grep -n "import axios\\|from 'axios'\\|from \\"axios\\"" src/ || true`,
    { 
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    }
  )

  if (!result.trim()) {
    console.log('✅ No raw axios imports found')
    process.exit(0)
  }

  const lines = result.trim().split('\n')
  const violations = []

  for (const line of lines) {
    const [filePath, ...rest] = line.split(':')
    const lineContent = rest.join(':')
    
    // Check if file is in allowlist
    const isAllowed = ALLOWLIST.some(allowed => filePath.includes(allowed))
    
    if (isAllowed) {
      continue
    }
    
    // Allow "import type { ... } from 'axios'" (type-only imports are safe)
    if (lineContent.includes('import type') && lineContent.includes('from')) {
      continue
    }
    
    violations.push(line)
  }

  if (violations.length === 0) {
    console.log('✅ All axios imports are in allowlist')
    process.exit(0)
  }

  console.error('❌ Found raw axios imports outside allowlist:\n')
  violations.forEach(v => console.error(`  ${v}`))
  console.error('\n💡 Use apiClient from @/utils/apiClient instead.')
  console.error('   Only these files can import axios directly:')
  ALLOWLIST.forEach(f => console.error(`   - ${f}`))
  
  process.exit(1)

} catch (err) {
  if (err.status === 1 && !err.stdout?.trim()) {
    // git grep found nothing - this is success
    console.log('✅ No raw axios imports found')
    process.exit(0)
  }
  
  console.error('❌ Error running check:', err.message)
  process.exit(1)
}
