export function normalizeLocale(raw) {
  const v = String(raw || 'en')
  return v.toLowerCase().replace('_', '-')
}

export function getLocaleCalendarRules(locale) {
  const l = normalizeLocale(locale)
  const base = l.split('-')[0]

  const rulesMap = {
    uk: { firstDay: 1, weekendDays: [6, 0] },
    'uk-ua': { firstDay: 1, weekendDays: [6, 0] },
    pl: { firstDay: 1, weekendDays: [6, 0] },
    'pl-pl': { firstDay: 1, weekendDays: [6, 0] },
    en: { firstDay: 0, weekendDays: [6, 0] },
    'en-us': { firstDay: 0, weekendDays: [6, 0] },
  }

  return rulesMap[l] || rulesMap[base] || { firstDay: 1, weekendDays: [6, 0] }
}
