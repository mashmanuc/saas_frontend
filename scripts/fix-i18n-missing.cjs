const fs = require('fs')
const path = require('path')

const ukPath = path.join(__dirname, '../src/i18n/locales/uk.json')
const enPath = path.join(__dirname, '../src/i18n/locales/en.json')

const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'))
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

// Missing keys in uk.json
const ukMissing = {
  'auth.register.titleStudent': 'Реєстрація студента',
  'auth.register.descriptionStudent': 'Створіть обліковий запис студента для навчання',
  'auth.register.wantToTeach': 'Хочете викладати?',
  'auth.register.registerAsTutor': 'Зареєструватися як репетитор',
  'auth.register.titleTutor': 'Реєстрація репетитора',
  'auth.register.descriptionTutor': 'Створіть обліковий запис репетитора для викладання',
  'auth.register.wantToLearn': 'Хочете навчатися?',
  'auth.register.registerAsStudent': 'Зареєструватися як студент',
  'common.changeLanguage': 'Змінити мову'
}

// Missing keys in en.json
const enMissing = {
  'roleSelection.title': 'Choose Your Role',
  'roleSelection.subtitle': 'Select how you want to use M4SH platform',
  'roleSelection.nav.howItWorks': 'How It Works',
  'roleSelection.nav.benefits': 'Benefits',
  'roleSelection.nav.login': 'Login',
  'roleSelection.student.title': 'Student',
  'roleSelection.student.description': 'Find tutors and learn new skills',
  'roleSelection.student.feature1': 'Access to verified tutors',
  'roleSelection.student.feature2': 'Flexible scheduling',
  'roleSelection.student.feature3': 'Interactive learning tools',
  'roleSelection.student.cta': 'Start Learning',
  'roleSelection.tutor.title': 'Tutor',
  'roleSelection.tutor.description': 'Share your knowledge and earn',
  'roleSelection.tutor.feature1': 'Set your own rates',
  'roleSelection.tutor.feature2': 'Manage your schedule',
  'roleSelection.tutor.feature3': 'Built-in teaching tools',
  'roleSelection.tutor.cta': 'Start Teaching',
  'roleSelection.howItWorks.title': 'How It Works',
  'roleSelection.howItWorks.subtitle': 'Get started in three simple steps',
  'roleSelection.howItWorks.step1.title': 'Create Account',
  'roleSelection.howItWorks.step1.description': 'Sign up as a student or tutor in minutes',
  'roleSelection.howItWorks.step2.title': 'Find Match',
  'roleSelection.howItWorks.step2.description': 'Browse profiles or receive inquiries',
  'roleSelection.howItWorks.step3.title': 'Start Learning',
  'roleSelection.howItWorks.step3.description': 'Connect and begin your educational journey',
  'roleSelection.benefits.title': 'Why Choose M4SH',
  'roleSelection.benefits.subtitle': 'Direct connection between students and tutors',
  'roleSelection.benefits.noMiddlemen.title': 'No Middlemen',
  'roleSelection.benefits.noMiddlemen.description': 'Direct communication between students and tutors',
  'roleSelection.benefits.affordablePrices.title': 'Affordable Prices',
  'roleSelection.benefits.affordablePrices.description': 'Fair rates without platform commissions',
  'roleSelection.benefits.directConnection.title': 'Direct Connection',
  'roleSelection.benefits.directConnection.description': 'Build lasting educational relationships'
}

function setNestedKey(obj, keyPath, value) {
  const keys = keyPath.split('.')
  let current = obj
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key]) {
      current[key] = {}
    }
    current = current[key]
  }
  
  current[keys[keys.length - 1]] = value
}

// Add missing keys to uk.json
console.log('Adding missing keys to uk.json...')
Object.entries(ukMissing).forEach(([key, value]) => {
  setNestedKey(uk, key, value)
  console.log(`  + ${key}`)
})

// Add missing keys to en.json
console.log('\nAdding missing keys to en.json...')
Object.entries(enMissing).forEach(([key, value]) => {
  setNestedKey(en, key, value)
  console.log(`  + ${key}`)
})

// Write back
fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2) + '\n', 'utf8')
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8')

console.log('\n✓ Done! Added 9 keys to uk.json and 33 keys to en.json')
