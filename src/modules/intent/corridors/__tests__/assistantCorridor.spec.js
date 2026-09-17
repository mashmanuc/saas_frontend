/**
 * Коридори Інтегралика — спільний стан предмета й мови (ТЗ 2026-09-17 §4, §11.3, §11.5).
 *
 * Стереже: «Авто» за замовчуванням; lock читається з сервера (reload); інша
 * дошка нічого не успадковує; пульт і палітра пишуть ОДНИМ REST; DESYNC/PAUSED
 * і readonly не пишуть; мова матеріалу не торкається профілю/EN_GUIDE.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AUTO, EVENT_COMMAND, EVENT_STATE, EVENT_STATE_REQUEST, createAssistantCorridor } from '../assistantCorridor'
import {
  ASSISTANT_COMMAND_EVENT, ASSISTANT_STATE_EVENT, ASSISTANT_STATE_REQUEST_EVENT,
} from '@/modules/winterboard/composables/useBoardRemote'

const SRC = resolve(__dirname, '../../../..')
const read = (rel) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')

const REGISTRY = {
  enabled: true,
  corridor_version: 1,
  subjects: [
    { id: 'general', labels: { uk: 'Загальний', en: 'General' } },
    { id: 'math', labels: { uk: 'Математика', en: 'Mathematics' } },
    { id: 'history', labels: { uk: 'Історія', en: 'History' } },
  ],
  lockable_subjects: ['math', 'history'],
  languages: [{ id: 'uk', labels: { uk: 'Українська', en: 'Ukrainian' } }, { id: 'en', labels: { uk: 'English', en: 'English' } }],
}

function http(status) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } })
}

function fakeApi(overrides = {}) {
  fakeApi.stored = {}
  return {
    fetchCorridorRegistry: vi.fn(async () => REGISTRY),
    getAssistantContext: vi.fn(async () => ({ enabled: true, readonly: false, assistant_context: { version: 1, subject: null, content_language: null } })),
    resolveCorridor: vi.fn(async () => ({
      subject: { mode: 'auto', resolved_subject: 'history', locked_subject: null, source: 'lesson' },
      language: { content_language: 'uk', content_mode: 'auto', content_source: 'ui_fallback' },
    })),
    // Як справжній сервер: PATCH змінює лише передане поле, відповідь — ПОВНИЙ контекст.
    patchAssistantContext: vi.fn(async (id, body) => {
      const stored = (fakeApi.stored[id] ||= { version: 1, subject: null, content_language: null })
      for (const field of ['subject', 'content_language']) {
        if (body[field] === undefined) continue
        stored[field] = body[field] === 'auto' ? null : { value: body[field], source: body.source, set_at: 'x' }
      }
      return { assistant_context: { ...stored } }
    }),
    ...overrides,
  }
}

describe('assistantCorridor · стан предмета й мови', () => {
  it('за замовчуванням «Авто» і нічого не зафіксовано', () => {
    const c = createAssistantCorridor(fakeApi())
    expect(c.state.subject).toMatchObject({ mode: AUTO, resolved: 'general', locked: null })
    expect(c.state.language).toMatchObject({ mode: AUTO, locked: null })
    expect(c.remoteSnapshot()).toBeNull()
  })

  it('404 реєстру = rollout-гейт вимкнений: мовчки, без помилки і без інших запитів', async () => {
    const api = fakeApi({ fetchCorridorRegistry: vi.fn(async () => { throw http(404) }) })
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    expect(c.state.enabled).toBe(false)
    expect(c.state.error).toBe('')
    expect(api.getAssistantContext).not.toHaveBeenCalled()
  })

  it('reload читає lock із сервера (lock переживає reload)', async () => {
    const api = fakeApi({
      getAssistantContext: vi.fn(async () => ({ readonly: false, assistant_context: {
        version: 1, subject: { value: 'history', source: 'explicit_remote', set_at: 'x' },
        content_language: { value: 'en', source: 'explicit_palette', set_at: 'x' } } })),
      resolveCorridor: vi.fn(async () => ({
        subject: { mode: 'locked', resolved_subject: 'history', locked_subject: 'history', source: 'explicit_remote' },
        language: { content_language: 'en', content_mode: 'locked', content_source: 'explicit_palette' },
      })),
    })
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    expect(c.state.subject).toMatchObject({ mode: 'locked', resolved: 'history', locked: 'history' })
    expect(c.state.language).toMatchObject({ mode: 'locked', content: 'en', locked: 'en' })
  })

  it('інша дошка не успадковує предмет попередньої (kill-проба 4)', async () => {
    const api = fakeApi()
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    await c.setSubject('math')
    expect(c.state.subject.locked).toBe('math')
    api.resolveCorridor.mockResolvedValueOnce({})
    await c.loadBoard('b2')
    expect(c.state.boardId).toBe('b2')
    expect(c.state.subject).toMatchObject({ mode: AUTO, locked: null })
  })

  it('палітра і пульт пишуть ОДНИМ REST, різниться лише source', async () => {
    const api = fakeApi()
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    await c.setSubject('history', 'explicit_palette')
    await c.setContentLanguage('en', 'explicit_remote')
    expect(api.patchAssistantContext.mock.calls).toEqual([
      ['b1', { subject: 'history', source: 'explicit_palette' }],
      ['b1', { content_language: 'en', source: 'explicit_remote' }],
    ])
    expect(c.remoteSnapshot()).toEqual({
      subject_mode: 'locked', subject: 'history', subject_source: 'explicit_palette',
      language_mode: 'locked', content_language: 'en',
    })
  })

  it('«Авто» знімає lock і перечитує автоматичне рішення', async () => {
    const api = fakeApi()
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    await c.setSubject('math')
    const refresh = vi.fn(async () => c.applyCorridor({ subject: { mode: 'auto', resolved_subject: 'history', source: 'lesson' } }))
    expect(await c.setSubject('auto', 'explicit_palette', { refresh })).toBe(true)
    expect(refresh).toHaveBeenCalledOnce()
    expect(c.state.subject).toMatchObject({ mode: AUTO, resolved: 'history', locked: null })
  })

  it('DESYNC/PAUSED: вибір НЕ записується і причина названа (ТЗ §9.8)', async () => {
    const api = fakeApi()
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    expect(await c.setSubject('math', 'explicit_remote', { syncBlocked: true })).toBe(false)
    expect(api.patchAssistantContext).not.toHaveBeenCalled()
    expect(c.state.error).toBe('corridorSyncBlocked')
  })

  it('учень бачить read-only і не пише', async () => {
    const api = fakeApi({ getAssistantContext: vi.fn(async () => ({ readonly: true, assistant_context: { version: 1, subject: null, content_language: null } })) })
    const c = createAssistantCorridor(api)
    await c.loadBoard('b1')
    expect(await c.setSubject('math')).toBe(false)
    expect(api.patchAssistantContext).not.toHaveBeenCalled()
    expect(c.state.error).toBe('corridorReadonly')
  })

  it('відповідь parse оновлює підпис наступною ж командою', async () => {
    const c = createAssistantCorridor(fakeApi())
    await c.loadBoard('b1')
    c.applyCorridor({
      subject: { mode: 'auto', resolved_subject: 'math', locked_subject: null, source: 'phrase' },
      language: { content_language: 'en', content_mode: 'auto', content_source: 'explicit_command' },
    })
    expect(c.state.subject).toMatchObject({ resolved: 'math', source: 'phrase' })
    expect(c.state.language).toMatchObject({ content: 'en', mode: AUTO, source: 'explicit_command' })
  })

  it('мова матеріалу не торкається профілю прав і англійського провідника (kill-проба 11)', () => {
    const src = read('modules/intent/corridors/assistantCorridor.js')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/EN_GUIDE|capability_profile|isEnglishGuide|setI18nLocale|i18n\.global/)
  })

  it('імена подій палітри й пульта збігаються (kill-проба 10: один канал, один стан)', () => {
    expect(EVENT_COMMAND).toBe(ASSISTANT_COMMAND_EVENT)
    expect(EVENT_STATE).toBe(ASSISTANT_STATE_EVENT)
    expect(EVENT_STATE_REQUEST).toBe(ASSISTANT_STATE_REQUEST_EVENT)
  })
})

describe('Коридори · підключення палітри й пульта', () => {
  const palette = read('modules/intent/CommandPalette.vue')
  const remote = read('modules/winterboard/views/WBRemoteView.vue')

  it('палітра і пульт показують ТОЙ САМИЙ селектор із ТОГО САМОГО реєстру (kill-проби 10, 13)', () => {
    expect(palette).toContain("import CorridorSelector from './corridors/CorridorSelector.vue'")
    expect(remote).toContain("import CorridorSelector from '@/modules/intent/corridors/CorridorSelector.vue'")
    expect(remote).toContain("import { fetchCorridorRegistry } from '@/modules/intent/corridors/corridorApi'")
    // жодного власного списку предметів/мов у пульті чи палітрі
    for (const src of [palette, remote]) {
      expect(src).not.toMatch(/['"]history['"]\s*,\s*['"]math['"]|['"]math['"]\s*,\s*['"]history['"]/)
    }
  })

  it('палітра застосовує коридор із відповіді parse і слухає намір пульта', () => {
    expect(palette).toContain('if (r?.corridor) corridor.applyCorridor(r.corridor)')
    expect(palette).toContain('window.addEventListener(EVENT_COMMAND, onCorridorRemoteCommand)')
    expect(palette).toMatch(/v-if="corridor\.state\.enabled && currentBoardId && !isEnglishGuide"/)
  })

  it('пульт шле лише намір: subject.*/language.* — команди, не REST і не board action (kill-проба 5)', () => {
    expect(remote).toContain("sendCmd('subject.set', { subject: value })")
    expect(remote).toContain("sendCmd('language.set', { language: value })")
    expect(remote).not.toContain('patchAssistantContext')
    expect(remote).not.toContain('runBoardAction')
    expect(remote).not.toContain('parseAi')
  })
})
