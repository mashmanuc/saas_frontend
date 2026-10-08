/**
 * Російська на трьох сторінках кабінету (власник 2026-09-29: «ці три сторінки не підтримують
 * російську мову — треба виправити»): «Пульт для телефону», «Мій план», «Допомога».
 *
 * Причина була одна: у ru.json бракувало ключів цих сторінок, і vue-i18n мовчки брав uk
 * (fallbackLocale) — у російському інтерфейсі сторінки стояли українською. `i18n:check`
 * цього не ловить: він звіряє лише uk ↔ en. Цей тест звіряє ru — рівно для цих сторінок.
 * Статті «Допомоги» — окремим файлом `helpArticles.ru.ts` (див. helpMenuMap.spec + нижче).
 *
 * 2026-09-30 (власник: «переходь до пульта») — те саме для самого пульта на телефоні
 * (WBRemoteView і його аркуші) та всього простору `winterboard.remote.*`.
 *
 * 2026-09-30 (власник: «бери вхід, запрошення і шапку уроку») — сторінки входу й
 * реєстрації, запрошення учня й «Мої учні», шапка уроку. На сторінках входу помилки
 * («Забагато запитів…», «Тимчасова помилка…») були зашиті в код українською —
 * тепер це ключі, і тест стереже, щоб кириличних рядків у їхньому коді не з'явилося знову.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import uk from '../locales/uk.json'
import ru from '../locales/ru.json'
import { HELP_SECTIONS } from '../../modules/help/data/helpArticles'
import { HELP_SECTIONS_RU } from '../../modules/help/data/helpArticles.ru'

const SRC = path.resolve(__dirname, '../..')

const PAGES: Record<string, string[]> = {
  'Пульт для телефону': [
    'modules/winterboard/views/WBRemoteConnectPage.vue',
    'modules/winterboard/views/WBRemoteEntry.vue',
    'modules/winterboard/components/remote/RemoteQrBlock.vue',
  ],
  'Мій план': [
    'modules/billing/views/AccountBillingView.vue',
    'modules/billing/components/EarlyAccessCard.vue',
    'modules/billing/components/CurrentPlanCard.vue',
    'modules/billing/components/UpgradeHint.vue',
    'modules/billing/components/PlansList.vue',
    'modules/billing/components/PlanCard.vue',
    'modules/billing/components/PaymentHistorySection.vue',
  ],
  'Допомога': ['modules/help/views/HelpView.vue'],
  'Пульт на телефоні': [
    'modules/winterboard/views/WBRemoteView.vue',
    'modules/winterboard/components/remote/RemotePhotoPanel.vue',
    'modules/winterboard/components/remote/RemoteScenarioSheet.vue',
    'modules/winterboard/components/remote/RemoteBoardMirror.vue',
  ],
  'Вхід і реєстрація': [
    'modules/auth/views/LoginView.vue',
    'modules/auth/views/RegisterTutorView.vue',
    'modules/auth/views/CheckEmailView.vue',
    'modules/auth/views/VerifyEmailView.vue',
    'modules/auth/views/ForgotPasswordView.vue',
    'modules/auth/views/ResetPasswordView.vue',
    'modules/auth/views/SessionEndedView.vue',
    'modules/auth/views/LogoutPendingView.vue',
    'modules/auth/components/GoogleSignInButton.vue',
    'modules/auth/components/WebAuthnPrompt.vue',
    'modules/auth/components/UnlockConfirmModal.vue',
    'modules/auth/components/AuthLayout.vue',
  ],
  'Запрошення учня': [
    'components/invites/InviteAcceptPage.vue',
    'components/invites/InviteCreateButton.vue',
    'modules/dashboard/views/TutorStudents.vue',
    'modules/dashboard/components/StudentContactUnlock.vue',
    'modules/lessons/views/LessonInviteResolveView.vue',
  ],
}

/** Шапка уроку (WBSoloRoom / WBClassroomRoom): ці файли великі, тож звіряємо ключі самої шапки. */
const HEADER_KEYS = [
  'winterboard.room.exitToLessons', 'winterboard.room.exitToStudio', 'winterboard.room.syncedViaTeacher',
  'winterboard.room.writerOffline', 'winterboard.room.clearPhotoBackground', 'winterboard.room.clearPhotoBackgroundTitle',
  'winterboard.lesson.copy.button', 'winterboard.lesson.copy.title', 'winterboard.lesson.copy.subtitle',
  'winterboard.lesson.copy.titleLabel', 'winterboard.lesson.copy.save', 'winterboard.lesson.copy.saving',
  'winterboard.lesson.copy.savingBanner', 'winterboard.lesson.copy.defaultTitle',
  'winterboard.enrich.reviewButton', 'winterboard.export.aiEnrich', 'winterboard.recording.start',
]

type Dict = Record<string, unknown>

function flat(obj: Dict, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v as Dict, key, out)
    else out[key] = v
  }
  return out
}

const UK = flat(uk as Dict)
const RU = flat(ru as Dict)

/** Ключі, які сторінка бере: виклики t / $t з рядком-ключем + усі uk-ключі під префіксом шаблонного рядка. */
function keysOf(file: string): string[] {
  const src = fs.readFileSync(path.join(SRC, file), 'utf-8')
  const keys = new Set<string>()
  for (const m of src.matchAll(/\$?t\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g)) keys.add(m[1])
  for (const m of src.matchAll(/\$?t\(\s*`([a-zA-Z0-9_.-]+)\.\$\{/g)) {
    for (const k of Object.keys(UK)) if (k.startsWith(`${m[1]}.`)) keys.add(k)
  }
  // ключі, що передаються як рядки (мапи, тернарники, пропси): будь-який рядок у лапках, що є ключем uk
  for (const m of src.matchAll(/['"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+){1,6})['"]/g)) keys.add(m[1])
  return [...keys].filter((k) => k in UK)
}

describe.each(Object.entries(PAGES))('ru · «%s»', (_page, files) => {
  it.each(files)('%s — кожен ключ сторінки є в ru.json', (file) => {
    const keys = keysOf(file)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((k) => !(k in RU))).toEqual([])
  })
})

it('ru · пункт меню «Пульт для телефону» — російською', () => {
  expect(RU['sidebar.item.remote']).toBe('Пульт для телефона')
})

it('ru · «Допомога» — ті самі розділи й статті, що в uk (slug/key/icon), текст — російською', () => {
  const shape = (sections: typeof HELP_SECTIONS) =>
    sections.map((s) => ({ key: s.key, icon: s.icon, slugs: s.articles.map((a) => a.slug) }))
  expect(shape(HELP_SECTIONS_RU)).toEqual(shape(HELP_SECTIONS))
  // жодної української літери в російських статтях
  const text = JSON.stringify(HELP_SECTIONS_RU)
  expect(text.match(/[іїєґІЇЄҐ]/g) ?? []).toEqual([])
})

it('ru · пульт: увесь простір winterboard.remote.* є в ru, з тими самими {плейсхолдерами} і без українських літер', () => {
  const ukKeys = Object.keys(UK).filter((k) => k.startsWith('winterboard.remote.'))
  expect(ukKeys.length).toBeGreaterThan(200)
  expect(ukKeys.filter((k) => !(k in RU))).toEqual([])
  const placeholders = (v: unknown) => (String(v).match(/\{\w+\}/g) ?? []).sort()
  expect(ukKeys.filter((k) => JSON.stringify(placeholders(RU[k])) !== JSON.stringify(placeholders(UK[k])))).toEqual([])
  expect(ukKeys.filter((k) => /[іїєґІЇЄҐ]/.test(String(RU[k])))).toEqual([])
})

it('ru · шапка уроку: кнопки й стани шапки — російською', () => {
  expect(HEADER_KEYS.filter((k) => !(k in UK))).toEqual([])
  expect(HEADER_KEYS.filter((k) => !(k in RU))).toEqual([])
  expect(HEADER_KEYS.filter((k) => /[іїєґІЇЄҐ]/.test(String(RU[k])))).toEqual([])
})

// Помилки на сторінках входу були зашиті в код українською («Забагато запитів…»): у ru/en
// їх показувало українською. Тепер — ключі auth.requestErrors.* тощо; кирилиці в коді бути не має.
it.each([
  'modules/auth/views/CheckEmailView.vue',
  'modules/auth/views/VerifyEmailView.vue',
  'modules/auth/views/ForgotPasswordView.vue',
  'modules/auth/views/ResetPasswordView.vue',
])('%s — у коді немає рядків кирилицею (лише ключі)', (file) => {
  const src = fs.readFileSync(path.join(SRC, file), 'utf-8')
  const code = (src.split('<script')[1] ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n')
  const literals = [...code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3])
  expect(literals.filter((s) => /[А-Яа-яІіЇїЄєҐґ]/.test(s))).toEqual([])
})
