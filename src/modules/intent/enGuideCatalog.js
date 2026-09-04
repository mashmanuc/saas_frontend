// English Guide навмисно детермінований: тут факти про інтерфейс, а не відповіді
// моделі. Тримаємо назви маршрутів, не сирі URL, щоб зміна роутера стала видимою
// у викликачі та тестах.

export const EN_GUIDE_ROUTES = Object.freeze({
  'winterboard-boards': {
    label: 'Lesson Studio',
    description: 'This is your workspace for preparing lessons and boards.',
  },
  MyLessons: {
    label: 'My Lessons',
    description: 'This is where your saved lessons are listed.',
  },
  'winterboard-library': {
    label: 'Materials',
    description: 'This is where your uploaded files and teaching materials live.',
  },
  help: {
    label: 'Help',
    description: 'This is the help centre for using M4SH.',
  },
})

export const EN_GUIDE_NAVIGATION = Object.freeze([
  { id: 'en-guide-studio', label: 'Lesson Studio', routeName: 'winterboard-boards' },
  { id: 'en-guide-lessons', label: 'My Lessons', routeName: 'MyLessons' },
  { id: 'en-guide-materials', label: 'Materials', routeName: 'winterboard-library' },
  { id: 'en-guide-help', label: 'Help', routeName: 'help' },
])

export function describeEnGuideRoute(page = {}) {
  const known = EN_GUIDE_ROUTES[page.name]
  if (known) return `You are in ${known.label}. ${known.description}`

  const path = typeof page.path === 'string' && page.path ? page.path : 'this section'
  return `You are on ${path}. This section is not yet described in English Guide.`
}

export function explainEnGuideCapabilities(page = {}) {
  return `${describeEnGuideRoute(page)} English Guide can help you find your way around M4SH. It cannot create, change, save, publish, or generate lessons and boards.`
}
