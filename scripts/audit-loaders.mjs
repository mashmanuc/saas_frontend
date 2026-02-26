#!/usr/bin/env node
/**
 * AUDIT SCRIPT: Виявлення зациклених лодерів
 * 
 * Шукає патерни де isLoading = true не гарантовано скидається в false:
 * 1. isLoading = true без try/finally
 * 2. loader.start() без гарантованого loader.stop()
 * 3. async функції де isLoading = true перед await, але catch не скидає
 * 4. return всередині try без скидання isLoading
 * 5. rethrowAsDomainError без catch (пробиває finally)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.resolve(__dirname, '../src')

const ISSUES = []

function walkDir(dir, extensions = ['.vue', '.ts', '.js']) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...walkDir(fullPath, extensions))
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relPath = path.relative(SRC_DIR, filePath).replace(/\\/g, '/')
  const issues = []

  // Pattern 1: isLoading.value = true або this.isLoading = true
  // без відповідного finally { isLoading = false }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Detect isLoading = true
    if (/isLoading\.value\s*=\s*true|this\.isLoading\s*=\s*true|isLoading\s*=\s*true/.test(trimmed)) {
      // Check if inside a function with try/finally
      const fnContext = findFunctionContext(lines, i)
      if (fnContext) {
        const fnBody = lines.slice(fnContext.start, fnContext.end + 1).join('\n')
        
        // Check for finally block with isLoading = false
        const hasFinally = /finally\s*\{[^}]*isLoading[^}]*=\s*false/s.test(fnBody) ||
                          /finally\s*\{[^}]*isLoading\.value\s*=\s*false/s.test(fnBody) ||
                          /finally\s*\{[^}]*this\.isLoading\s*=\s*false/s.test(fnBody)
        
        if (!hasFinally) {
          issues.push({
            file: relPath,
            line: i + 1,
            type: 'NO_FINALLY',
            severity: 'CRITICAL',
            message: `isLoading = true without finally { isLoading = false } in function "${fnContext.name}"`,
            code: trimmed
          })
        }

        // Pattern 2: return inside try block before isLoading = false
        const tryBlock = extractTryBlock(lines, fnContext.start, fnContext.end)
        if (tryBlock) {
          const tryBody = lines.slice(tryBlock.start, tryBlock.end + 1).join('\n')
          const returnCount = (tryBody.match(/\breturn\b/g) || []).length
          if (returnCount > 0) {
            // Check if return is before a potential isLoading = false
            // This is OK if finally block exists
            if (!hasFinally) {
              issues.push({
                file: relPath,
                line: tryBlock.start + 1,
                type: 'RETURN_IN_TRY_NO_FINALLY',
                severity: 'CRITICAL',
                message: `return inside try block without finally in "${fnContext.name}" — isLoading stays true if early return`,
                code: 'return ...'
              })
            }
          }
        }

        // Pattern 3: rethrowAsDomainError inside catch — rethrows, skipping finally?
        // Actually rethrow doesn't skip finally, but if catch rethrows and there's no finally...
        if (!hasFinally) {
          const hasCatch = /catch\s*\([^)]*\)\s*\{/.test(fnBody)
          const hasRethrow = /rethrowAsDomainError|throw\s+/.test(fnBody)
          if (hasCatch && hasRethrow) {
            issues.push({
              file: relPath,
              line: i + 1,
              type: 'RETHROW_NO_FINALLY',
              severity: 'HIGH',
              message: `catch rethrows error but no finally to reset isLoading in "${fnContext.name}"`,
              code: trimmed
            })
          }
        }
      }
    }

    // Pattern 4: loader.start() count vs loader.stop() count
    if (/loader\.start\(\)/.test(trimmed)) {
      const fnContext = findFunctionContext(lines, i)
      if (fnContext) {
        const fnBody = lines.slice(fnContext.start, fnContext.end + 1).join('\n')
        const startCount = (fnBody.match(/loader\.start\(\)/g) || []).length
        const stopCount = (fnBody.match(/loader\.stop\(\)/g) || []).length
        if (startCount > stopCount) {
          issues.push({
            file: relPath,
            line: i + 1,
            type: 'LOADER_IMBALANCE',
            severity: 'CRITICAL',
            message: `loader.start() called ${startCount}x but stop() only ${stopCount}x in "${fnContext.name}"`,
            code: trimmed
          })
        }
      }
    }

    // Pattern 5: setTimeout that sets isLoading = false — fragile
    if (/setTimeout.*isLoading.*false|setTimeout.*loading.*false/.test(trimmed)) {
      issues.push({
        file: relPath,
        line: i + 1,
        type: 'SETTIMEOUT_LOADER_RESET',
        severity: 'MEDIUM',
        message: 'isLoading reset via setTimeout — fragile, may not execute if component unmounts',
        code: trimmed
      })
    }

    // Pattern 6: setInterval without cleanup checking isLoading
    if (/setInterval/.test(trimmed) && !trimmed.includes('//')) {
      // Check if clearInterval is in same scope
      const fnContext = findFunctionContext(lines, i)
      if (fnContext) {
        const fnBody = lines.slice(fnContext.start, fnContext.end + 1).join('\n')
        // Check broader file context for clearInterval
        if (!content.includes('clearInterval')) {
          issues.push({
            file: relPath,
            line: i + 1,
            type: 'INTERVAL_NO_CLEAR',
            severity: 'MEDIUM',
            message: 'setInterval without clearInterval — potential memory leak and polling loop',
            code: trimmed
          })
        }
      }
    }
  }

  return issues
}

function findFunctionContext(lines, targetLine) {
  // Walk backward to find function start
  let braceCount = 0
  let fnStart = -1
  let fnEnd = -1
  let fnName = 'anonymous'

  // Find the opening brace of the containing function
  for (let i = targetLine; i >= 0; i--) {
    const line = lines[i]
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') braceCount++
      if (line[j] === '{') braceCount--
    }
    if (braceCount < 0) {
      fnStart = i
      // Try to extract function name
      const fnMatch = line.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*\(/) ||
                      lines[Math.max(0, i - 1)]?.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*\(/)
      if (fnMatch) fnName = fnMatch[1]
      break
    }
  }

  if (fnStart === -1) return null

  // Find the closing brace
  braceCount = 0
  for (let i = fnStart; i < lines.length; i++) {
    const line = lines[i]
    for (const ch of line) {
      if (ch === '{') braceCount++
      if (ch === '}') braceCount--
    }
    if (braceCount === 0) {
      fnEnd = i
      break
    }
  }

  return fnEnd !== -1 ? { start: fnStart, end: fnEnd, name: fnName } : null
}

function extractTryBlock(lines, start, end) {
  for (let i = start; i <= end; i++) {
    if (/\btry\s*\{/.test(lines[i])) {
      let braceCount = 0
      for (let j = i; j <= end; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') braceCount++
          if (ch === '}') braceCount--
        }
        if (braceCount === 0) {
          return { start: i, end: j }
        }
      }
    }
  }
  return null
}

// ====== MAIN ======
console.log('🔍 АУДИТ ЗАЦИКЛЕНИХ ЛОДЕРІВ')
console.log('=' .repeat(60))

const files = walkDir(SRC_DIR)
console.log(`\nСканую ${files.length} файлів...\n`)

for (const file of files) {
  try {
    const issues = analyzeFile(file)
    ISSUES.push(...issues)
  } catch (err) {
    // Skip parse errors
  }
}

// Group and sort
const critical = ISSUES.filter(i => i.severity === 'CRITICAL')
const high = ISSUES.filter(i => i.severity === 'HIGH')
const medium = ISSUES.filter(i => i.severity === 'MEDIUM')

console.log(`\n${'='.repeat(60)}`)
console.log(`РЕЗУЛЬТАТИ АУДИТУ`)
console.log(`${'='.repeat(60)}`)
console.log(`🔴 CRITICAL: ${critical.length}`)
console.log(`🟠 HIGH:     ${high.length}`)
console.log(`🟡 MEDIUM:   ${medium.length}`)
console.log(`${'='.repeat(60)}\n`)

function printIssues(issues, label) {
  if (!issues.length) return
  console.log(`\n--- ${label} ---\n`)
  for (const issue of issues) {
    console.log(`  ${issue.file}:${issue.line}`)
    console.log(`    [${issue.type}] ${issue.message}`)
    console.log()
  }
}

printIssues(critical, '🔴 CRITICAL')
printIssues(high, '🟠 HIGH')
printIssues(medium, '🟡 MEDIUM')

// Generate markdown report
const reportPath = path.resolve(__dirname, '../docs/INFINITE_LOOP_AUDIT_2026.md')
let md = `# Аудит зациклених лодерів — ${new Date().toISOString().slice(0, 10)}\n\n`
md += `## Результати\n\n`
md += `| Severity | Count |\n|---|---|\n`
md += `| 🔴 CRITICAL | ${critical.length} |\n`
md += `| 🟠 HIGH | ${high.length} |\n`
md += `| 🟡 MEDIUM | ${medium.length} |\n\n`

md += `## Проблеми\n\n`
for (const issue of [...critical, ...high, ...medium]) {
  md += `### \`${issue.file}:${issue.line}\`\n`
  md += `- **Severity**: ${issue.severity}\n`
  md += `- **Type**: ${issue.type}\n`
  md += `- **Message**: ${issue.message}\n\n`
}

fs.writeFileSync(reportPath, md, 'utf-8')
console.log(`\n📄 Звіт записано: ${reportPath}`)
