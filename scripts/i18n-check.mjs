import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SUPPORTED_LOCALES = ['uk', 'en']
const REFERENCE_LOCALE = 'uk'
const USAGE_SCAN_DIRS = ['src']
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.nuxt',
  '.next',
  'coverage',
  '.output'
])
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue'
])
const TRANSLATION_FUNCTIONS = new Set(['t', '$t', 'translate'])

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function flattenKeys(obj, prefix = '', collector = new Map()) {
  if (!isObject(obj)) return collector

  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k
    
    if (isObject(v)) {
      flattenKeys(v, next, collector)
    } else {
      const existing = collector.get(next)
      if (existing) {
        console.warn(`[i18n-check] DUPLICATE KEY: "${next}" appears multiple times`)
      }
      collector.set(next, v)
    }
  }

  return collector
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

function diffKeys(reference, target) {
  const missing = []
  for (const key of reference.keys()) {
    if (!target.has(key)) missing.push(key)
  }
  return missing.sort()
}

function findEmptyValues(keysMap) {
  const empty = []
  for (const [key, value] of keysMap.entries()) {
    if (value === '' || value === null || value === undefined) {
      empty.push(key)
    }
  }
  return empty.sort()
}

function shouldScanFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath))
}

function collectUsageKeys(rootDir) {
  const usageKeys = new Set()
  let filesScanned = 0

  const simpleCallRegex = /\b([A-Za-z0-9_$]+)\(\s*(['`"])([^'"`]+?)\2/g
  const complexPatterns = [
    /\bi18n\.global\.t\(\s*(['`"])([^'"`]+?)\1/g,
    /\bi18n\.t\(\s*(['`"])([^'"`]+?)\1/g,
    /\buseI18n\(\)\.t\(\s*(['`"])([^'"`]+?)\1/g,
    /\$t\(\s*(['`"])([^'"`]+?)\1/g
  ]

  function extractKeys(content) {
    simpleCallRegex.lastIndex = 0
    let match
    while ((match = simpleCallRegex.exec(content)) !== null) {
      const fn = match[1]
      if (TRANSLATION_FUNCTIONS.has(fn)) {
        usageKeys.add(match[3])
      }
    }
    for (const pattern of complexPatterns) {
      pattern.lastIndex = 0
      let complexMatch
      while ((complexMatch = pattern.exec(content)) !== null) {
        usageKeys.add(complexMatch[2])
      }
    }
  }

  function walk(dirPath) {
    if (!fs.existsSync(dirPath)) return
    const stats = fs.statSync(dirPath)
    if (stats.isFile()) {
      if (!shouldScanFile(dirPath)) return
      const content = fs.readFileSync(dirPath, 'utf-8')
      extractKeys(content)
      filesScanned += 1
      return
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue
      const nextPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
      } else if (entry.isFile() && shouldScanFile(nextPath)) {
        const content = fs.readFileSync(nextPath, 'utf-8')
        extractKeys(content)
        filesScanned += 1
      }
    }
  }

  for (const dir of USAGE_SCAN_DIRS) {
    const abs = path.join(rootDir, dir)
    walk(abs)
  }

  return { usageKeys, filesScanned }
}

function main() {
  const args = process.argv.slice(2)
  const reportMode = args.includes('--report')
  const disableUsageScan = args.includes('--no-usage')
  
  const root = process.cwd()
  const localesDir = path.join(root, 'src', 'i18n', 'locales')
  
  const refPath = path.join(localesDir, `${REFERENCE_LOCALE}.json`)
  const refData = readJson(refPath)
  
  if (!refData) {
    console.error(`[i18n-check] ERROR: Reference locale ${REFERENCE_LOCALE}.json not found`)
    process.exit(1)
  }
  
  const refKeys = flattenKeys(refData)
  console.log(`[i18n-check] Reference locale (${REFERENCE_LOCALE}): ${refKeys.size} keys`)

  let hasErrors = false
  const report = {
    locales: {},
    summary: {
      totalKeys: refKeys.size,
      locales: SUPPORTED_LOCALES.length,
      errors: 0,
      warnings: 0
    }
  }

  if (!disableUsageScan) {
    const { usageKeys, filesScanned } = collectUsageKeys(root)
    const unusedKeys = []
    for (const key of refKeys.keys()) {
      if (!usageKeys.has(key)) unusedKeys.push(key)
    }
    const undefinedUsages = []
    for (const key of usageKeys) {
      if (!refKeys.has(key)) undefinedUsages.push(key)
    }

    if (unusedKeys.length > 0) {
      console.warn(`\n[i18n-check] Unused keys in ${REFERENCE_LOCALE}.json (${unusedKeys.length}):`)
      for (const key of unusedKeys.slice(0, 10)) console.warn(`  - ${key}`)
      if (unusedKeys.length > 10) console.warn(`  ... and ${unusedKeys.length - 10} more`)
      report.summary.warnings++
    }

    if (undefinedUsages.length > 0) {
      console.error(`\n[i18n-check] Keys used in code but missing in ${REFERENCE_LOCALE}.json (${undefinedUsages.length}):`)
      for (const key of undefinedUsages.slice(0, 10)) console.error(`  - ${key}`)
      if (undefinedUsages.length > 10) console.error(`  ... and ${undefinedUsages.length - 10} more`)
      hasErrors = true
      report.summary.errors++
    }

    report.usage = {
      scannedFiles: filesScanned,
      detectedKeys: usageKeys.size,
      unusedKeys: unusedKeys.sort(),
      undefinedUsages: undefinedUsages.sort()
    }
  }

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === REFERENCE_LOCALE) continue

    const localePath = path.join(localesDir, `${locale}.json`)
    const localeData = readJson(localePath)
    
    if (!localeData) {
      console.error(`[i18n-check] ERROR: Locale file ${locale}.json not found`)
      hasErrors = true
      report.locales[locale] = { status: 'missing_file', missing: [], empty: [] }
      report.summary.errors++
      continue
    }
    
    const localeKeys = flattenKeys(localeData)
    const missing = diffKeys(refKeys, localeKeys)
    const extra = diffKeys(localeKeys, refKeys)
    const empty = findEmptyValues(localeKeys)
    
    report.locales[locale] = {
      status: 'ok',
      totalKeys: localeKeys.size,
      missing,
      extra,
      empty
    }
    
    if (missing.length > 0) {
      console.error(`\n[i18n-check] Missing in ${locale}.json (${missing.length}):`)
      for (const k of missing.slice(0, 10)) console.error(`  - ${k}`)
      if (missing.length > 10) console.error(`  ... and ${missing.length - 10} more`)
      hasErrors = true
      report.summary.errors++
    }
    
    if (extra.length > 0) {
      console.warn(`\n[i18n-check] Extra keys in ${locale}.json (${extra.length}):`)
      for (const k of extra.slice(0, 10)) console.warn(`  - ${k}`)
      if (extra.length > 10) console.warn(`  ... and ${extra.length - 10} more`)
      report.summary.warnings++
    }
    
    if (empty.length > 0) {
      console.warn(`\n[i18n-check] Empty values in ${locale}.json (${empty.length}):`)
      for (const k of empty.slice(0, 10)) console.warn(`  - ${k}`)
      if (empty.length > 10) console.warn(`  ... and ${empty.length - 10} more`)
      report.summary.warnings++
    }
  }
  
  if (reportMode) {
    const reportPath = path.join(root, 'i18n-check-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n[i18n-check] Report saved to ${reportPath}`)
  }
  
  if (hasErrors) {
    console.error('\n[i18n-check] FAILED: i18n keys validation failed')
    process.exit(1)
  }
  
  console.log('\n[i18n-check] ✓ OK: All locales are consistent')
}

main()
