import fs from 'node:fs'
import path from 'node:path'

const reportPath = path.join(process.cwd(), 'i18n-check-report.json')
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))

const unusedKeys = report.usage.unusedKeys || []

console.log(`Аналіз ${unusedKeys.length} unused keys\n`)

// Класифікація за категоріями
const categories = {
  placeholders: [],
  deprecated: [],
  templateVars: [],
  billing: [],
  auth: [],
  tutor: [],
  student: [],
  classroom: [],
  other: []
}

for (const key of unusedKeys) {
  // Template variables (${...})
  if (key.includes('${')) {
    categories.templateVars.push(key)
  }
  // Billing features та errors
  else if (key.startsWith('billing.')) {
    categories.billing.push(key)
  }
  // Auth MFA та інші auth features
  else if (key.startsWith('auth.')) {
    categories.auth.push(key)
  }
  // Tutor profile placeholders
  else if (key.includes('Placeholder') || key.includes('placeholder')) {
    categories.placeholders.push(key)
  }
  // Tutor domain
  else if (key.startsWith('tutor.')) {
    categories.tutor.push(key)
  }
  // Student domain
  else if (key.startsWith('student.')) {
    categories.student.push(key)
  }
  // Classroom domain
  else if (key.startsWith('classroom.')) {
    categories.classroom.push(key)
  }
  // Deprecated або старі ключі
  else if (key.includes('legacy') || key.includes('old') || key.includes('deprecated')) {
    categories.deprecated.push(key)
  }
  else {
    categories.other.push(key)
  }
}

console.log('📊 Класифікація unused keys:\n')
console.log(`🔸 Template variables (\${...}): ${categories.templateVars.length}`)
console.log(`🔸 Placeholders: ${categories.placeholders.length}`)
console.log(`🔸 Billing features: ${categories.billing.length}`)
console.log(`🔸 Auth/MFA: ${categories.auth.length}`)
console.log(`🔸 Tutor domain: ${categories.tutor.length}`)
console.log(`🔸 Student domain: ${categories.student.length}`)
console.log(`🔸 Classroom domain: ${categories.classroom.length}`)
console.log(`🔸 Deprecated: ${categories.deprecated.length}`)
console.log(`🔸 Other: ${categories.other.length}`)

// Зберегти детальний звіт
const detailedReport = {
  summary: {
    total: unusedKeys.length,
    categories: Object.fromEntries(
      Object.entries(categories).map(([k, v]) => [k, v.length])
    )
  },
  categories,
  recommendations: {
    templateVars: 'KEEP - Використовуються для динамічної інтерполяції',
    placeholders: 'REVIEW - Можливо використовуються в формах, перевірити вручну',
    billing: 'KEEP - Майбутні features згідно roadmap',
    auth: 'KEEP - MFA features в backlog',
    tutor: 'REVIEW - Перевірити чи використовуються в туторських флоу',
    student: 'REVIEW - Перевірити чи використовуються в студентських флоу',
    classroom: 'REVIEW - Перевірити чи використовуються в classroom features',
    deprecated: 'REMOVE - Після підтвердження що не використовуються',
    other: 'REVIEW - Потребує детального аналізу'
  }
}

const outputPath = path.join(process.cwd(), 'i18n-unused-keys-analysis.json')
fs.writeFileSync(outputPath, JSON.stringify(detailedReport, null, 2) + '\n', 'utf-8')

console.log(`\n✓ Детальний звіт збережено: ${outputPath}`)
