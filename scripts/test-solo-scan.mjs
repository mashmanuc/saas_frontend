import fs from 'node:fs'

const content = fs.readFileSync('src/modules/solo/components/toolbar/SoloToolbar.vue', 'utf-8')

// Test regex patterns
const pattern1 = /\$t\(\s*(['`"])([^'"`]+?)\1/g
let matches = []
let match

while ((match = pattern1.exec(content)) !== null) {
  matches.push(match[2])
}

console.log(`Found ${matches.length} $t() calls`)
console.log('First 10:', matches.slice(0, 10))
