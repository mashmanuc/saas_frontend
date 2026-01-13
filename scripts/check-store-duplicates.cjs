#!/usr/bin/env node
/**
 * CI Check: Prevent duplicate Pinia store IDs
 * 
 * This script ensures that no two stores use the same defineStore() ID,
 * which can cause runtime conflicts and hard-to-debug issues.
 * 
 * Usage:
 *   node scripts/check-store-duplicates.js
 * 
 * Exit codes:
 *   0 - No duplicates found
 *   1 - Duplicates detected
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const STORE_DIRS = [
  'src/stores',
  'src/modules/*/stores'
]

function findStoreFiles() {
  const files = []
  
  for (const pattern of STORE_DIRS) {
    try {
      const result = execSync(`git ls-files "${pattern}/*.ts" "${pattern}/*.js"`, {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
      })
      
      files.push(...result.trim().split('\n').filter(Boolean))
    } catch (err) {
      // Directory might not exist, skip
    }
  }
  
  return files
}

function extractStoreId(filePath) {
  const fullPath = path.join(__dirname, '..', filePath)
  
  if (!fs.existsSync(fullPath)) {
    return null
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8')
  
  // Match: defineStore('store-id', ...)
  const match = content.match(/defineStore\s*\(\s*['"`]([^'"`]+)['"`]/)
  
  if (match) {
    return match[1]
  }
  
  return null
}

function main() {
  console.log('🔍 Checking for duplicate Pinia store IDs...\n')
  
  const storeFiles = findStoreFiles()
  
  if (storeFiles.length === 0) {
    console.log('⚠️  No store files found')
    process.exit(0)
  }
  
  const storeMap = new Map()
  
  for (const file of storeFiles) {
    const storeId = extractStoreId(file)
    
    if (!storeId) {
      continue
    }
    
    if (storeMap.has(storeId)) {
      storeMap.get(storeId).push(file)
    } else {
      storeMap.set(storeId, [file])
    }
  }
  
  // Find duplicates
  const duplicates = []
  
  for (const [storeId, files] of storeMap.entries()) {
    if (files.length > 1) {
      duplicates.push({ storeId, files })
    }
  }
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicate store IDs found')
    console.log(`   Checked ${storeFiles.length} store files\n`)
    process.exit(0)
  }
  
  // Report duplicates
  console.error('❌ Duplicate store IDs detected!\n')
  
  for (const { storeId, files } of duplicates) {
    console.error(`Store ID: "${storeId}"`)
    console.error('  Found in:')
    for (const file of files) {
      console.error(`    - ${file}`)
    }
    console.error('')
  }
  
  console.error('⚠️  Each Pinia store must have a unique ID.')
  console.error('   Please rename one of the stores or remove the duplicate.\n')
  
  process.exit(1)
}

main()
