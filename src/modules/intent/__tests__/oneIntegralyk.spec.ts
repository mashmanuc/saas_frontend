/**
 * «Один Інтегралик», пакет 1 (власник 2026-10-18; `saas_docs/domains/intent/INTEGRALYK_UNIFICATION_2026-10-18.md` §0):
 * ✨/🔎 прибрано, ім'я помічника одне (без «AI» у текстах учителя), Ctrl+K слухається вимикача,
 * «Що прочитав Інтегралик» і вставка інструмента — і в класі, вибір предмета прибрано,
 * на пульті — мінімальний підпис голос / текст.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import { isLessonEnrichEnabled } from '@/modules/winterboard/config/featureFlags'
import { ASSISTANT_NAMES } from '../assistantLook'

const src = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf-8')

describe('✨ «Збагатити урок» і 🔎 «Рецензія» прибрано', () => {
  afterEach(() => localStorage.removeItem('lesson_enrich_enabled'))

  it('типово вимкнено; увімкнути можна лише явно (стенд)', () => {
    expect(isLessonEnrichEnabled()).toBe(false)
    localStorage.setItem('lesson_enrich_enabled', 'true')
    expect(isLessonEnrichEnabled()).toBe(true)
  })

  it('кнопки в шапці конструктора — лише за прапорцем, і без нього артефакт не питаємо', () => {
    const room = src('modules/winterboard/views/WBSoloRoom.vue')
    expect(room).toMatch(/const lessonEnrichEnabled = isLessonEnrichEnabled\(\)/)
    expect(room).toMatch(/hasEnrichableLesson = computed\(\s*\(\) => !!\(lessonEnrichEnabled &&/)
    expect(room).toMatch(/if \(!lessonEnrichEnabled \|\| !isConstructor/)
  })
})

describe('ім\'я помічника одне — без «AI» у текстах учителя', () => {
  // Свідомо поза перевіркою: юридичні тексти, сховані ✨/🔎 (`winterboard.enrich`, `export.aiEnrich`),
  // заморожений «Copilot»/«AI-помічник» учня, внутрішні сторінки персоналу.
  const SKIP = /^(legal\.|winterboard\.enrich\.|winterboard\.export\.aiEnrich|winterboard\.copilot\.|staff\.)/
  function aiTexts(dict: unknown): string[] {
    const out: string[] = []
    const walk = (o: unknown, path: string) => {
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k)
      else if (typeof o === 'string' && !SKIP.test(path) && /(^|[^A-Za-z])AI([^A-Za-z]|$)/.test(o) && !o.includes('OpenAI')) out.push(path)
    }
    walk(dict, '')
    return out
  }
  it.each([['uk', uk], ['en', en], ['ru', ru]] as const)('%s', (_loc, dict) => {
    expect(aiTexts(dict)).toEqual([])
  })

  it('роль у підказці маскота — «помічник», без «AI»', () => {
    for (const look of Object.values(ASSISTANT_NAMES)) {
      expect(look.uk.role).not.toMatch(/AI/)
      expect(look.en.role).not.toMatch(/AI/)
    }
  })

  it('помилки у вікні — іменем помічника, з варіантом для «Інтегралки»', () => {
    const palette = src('modules/intent/CommandPalette.vue')
    expect(palette).not.toMatch(/'AI зараз недоступний|'Помилка AI'/)
    expect(palette).toMatch(/tAssistant\('winterboard\.remote\.assistant\.unavailable'\)/)
    expect(palette).toMatch(/tAssistant\('winterboard\.remote\.assistant\.failed'\)/)
    expect(uk.winterboard.remote.assistant.unavailable).toBe('Інтегралик зараз недоступний — спробуйте пізніше.')
    expect(uk.winterboard.remote.assistant.unavailableIntegralka).toBe('Інтегралка зараз недоступна — спробуйте пізніше.')
    expect(uk.winterboard.remote.assistant.failedIntegralka).toMatch(/^Інтегралка не змогла/)
  })
})

describe('Ctrl+K слухається вимикача «Показувати Інтегралика»', () => {
  it('закрите вікно з вимкненим помічником гарячі клавіші не відкривають', () => {
    const palette = src('modules/intent/CommandPalette.vue')
    const fn = palette.slice(palette.indexOf('function onKeydown'), palette.indexOf('onMounted(() => {', palette.indexOf('function onKeydown')))
    expect(fn).toMatch(/if \(!open\.value && !showAI\.value\) return/)
  })
})

describe('клас: та сама дія Інтегралика, що й удома', () => {
  const classroom = src('modules/winterboard/views/WBClassroomRoom.vue')
  it('«Що прочитав Інтегралик» — тим самим правилом, що ✍', () => {
    expect(classroom).toMatch(/:image-reading="selectedImageForReading"/)
    expect(classroom).toMatch(/const selectedImageForReading = computed\(\(\) => imageReadingTarget\(\{\s*enabled: canSolveHandwrite\.value/)
  })
  it('«Вставити інструмент» від Інтегралика виконується (а не лише «✓»); пульт — чесна відмова', () => {
    expect(classroom).toMatch(/window\.addEventListener\('m4sh:wb-insert', onIntegralykInsert\)/)
    expect(classroom).toMatch(/if \(!classroomRole\.isTeacher\.value \|\| !d\?\.mime \|\| d\.pageId\) return/)
    expect(classroom).toMatch(/contentDrop\.addAtPosition\(d\.mime/)
  })
})

describe('вибір «Предмет / Мова матеріалу» прибрано з вікна й з пульта', () => {
  it('селектора немає ніде в інтерфейсі вчителя', () => {
    expect(src('modules/intent/CommandPalette.vue')).not.toMatch(/<CorridorSelector/)
    expect(src('modules/winterboard/views/WBRemoteView.vue')).not.toMatch(/<CorridorSelector|fetchCorridorRegistry/)
  })
})

describe('пульт: мінімальний підпис різниці голос / текст', () => {
  it.each([['uk', uk], ['en', en], ['ru', ru]] as const)('%s', (_loc, dict) => {
    const r = dict.winterboard.remote
    expect(r.holdToTalk.length).toBeLessThanOrEqual(40)
    expect(r.assistant.placeholder.length).toBeLessThanOrEqual(40)
  })
  it('голос — «одразу на дошку», текст — «на наступну сторінку»', () => {
    expect(uk.winterboard.remote.holdToTalk).toBe('Говорю — одразу на дошку (тримати)')
    expect(uk.winterboard.remote.assistant.placeholder).toBe('Інтегралику — на наступну сторінку…')
    expect(uk.winterboard.remote.assistant.placeholderIntegralka).toBe('Інтегралці — на наступну сторінку…')
  })
})
