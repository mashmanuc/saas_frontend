/**
 * Б-202 (власник 2026-10-15): вікно «Дошку зручніше вести з комп'ютера або планшета» власнику
 * дошки на телефоні вертикально. Прод 15.10: учитель з реклами (iPhone) пішов з дошки за ~6 с;
 * на 390×844 аркуш займає 219 з 844 пікселів.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import {
  PHONE_BOARD_HINT_DISMISSED_KEY,
  isPhonePortrait,
  readPhoneBoardHintDismissed,
  rememberPhoneBoardHintDismissed,
  shouldShowPhoneBoardHint,
} from '../board/phoneBoardHint'
import WBPhoneBoardHint from '../components/phone/WBPhoneBoardHint.vue'

const OWNER_ON_IPHONE = {
  viewportWidth: 390, viewportHeight: 844, isSessionOwner: true, isLocalWorkspace: false, dismissed: false,
}

describe('коли показувати вікно', () => {
  it('телефон вертикально — так; горизонтально, планшет, ноутбук — ні', () => {
    expect(isPhonePortrait(390, 844)).toBe(true)
    expect(isPhonePortrait(375, 667)).toBe(true)
    expect(isPhonePortrait(639, 900)).toBe(true)
    expect(isPhonePortrait(640, 900)).toBe(false)   // поріг мобільного режиму дошки
    expect(isPhonePortrait(844, 390)).toBe(false)   // телефон горизонтально — поза рішенням
    expect(isPhonePortrait(768, 1024)).toBe(false)  // планшет вертикально
    expect(isPhonePortrait(1366, 768)).toBe(false)
    expect(isPhonePortrait(0, 0)).toBe(false)       // розмір ще не виміряно
  })

  it('лише власнику хмарної дошки й лише доки не обрав «Все одно відкрити»', () => {
    expect(shouldShowPhoneBoardHint(OWNER_ON_IPHONE)).toBe(true)
    expect(shouldShowPhoneBoardHint({ ...OWNER_ON_IPHONE, isSessionOwner: false })).toBe(false) // учень-глядач
    expect(shouldShowPhoneBoardHint({ ...OWNER_ON_IPHONE, isLocalWorkspace: true })).toBe(false) // гість
    expect(shouldShowPhoneBoardHint({ ...OWNER_ON_IPHONE, dismissed: true })).toBe(false)
    expect(shouldShowPhoneBoardHint({ ...OWNER_ON_IPHONE, viewportWidth: 1366, viewportHeight: 768 })).toBe(false)
  })
})

describe('«Все одно відкрити дошку» запам’ятовується на пристрої', () => {
  beforeEach(() => localStorage.clear())

  it('до вибору — питаємо, після — ні', () => {
    expect(readPhoneBoardHintDismissed()).toBe(false)
    rememberPhoneBoardHintDismissed()
    expect(localStorage.getItem(PHONE_BOARD_HINT_DISMISSED_KEY)).toBe('1')
    expect(readPhoneBoardHintDismissed()).toBe(true)
  })

  it('localStorage недоступний — дошку це не ламає, просто питаємо знову', () => {
    // Як у приватному вікні Safari: саме звернення до localStorage кидає SecurityError.
    const blocked = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked') })
    expect(() => rememberPhoneBoardHintDismissed()).not.toThrow()
    expect(readPhoneBoardHintDismissed()).toBe(false)
    blocked.mockRestore()
  })
})

describe('WBPhoneBoardHint — вікно', () => {
  it('заголовок, текст і дві кнопки; кожна шле свою подію', async () => {
    const w = mount(WBPhoneBoardHint, { global: { stubs: { Teleport: true } } })
    const text = w.text()
    expect(text).toContain('winterboard.phoneHint.title')
    expect(text).toContain('winterboard.phoneHint.body')
    await w.find('[data-testid="phone-board-hint-understood"]').trigger('click')
    await w.find('[data-testid="phone-board-hint-open"]').trigger('click')
    expect(Object.keys(w.emitted())).toEqual(expect.arrayContaining(['understood', 'open-anyway']))
    expect(w.emitted('understood')).toHaveLength(1)
    expect(w.emitted('open-anyway')).toHaveLength(1)
  })
})

describe('WBSoloRoom підключає вікно за цим правилом', () => {
  // Кімнату в тестах не змонтувати (вона тягне Konva, WS і стори) — звіряємо розмітку й виклик.
  const src = readFileSync(resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8')

  it('вікно показується лише через shouldShowPhoneBoardHint з власником і локальною дошкою', () => {
    expect(src).toMatch(/<WBPhoneBoardHint\s+v-if="showPhoneBoardHint"/)
    expect(src).toMatch(/shouldShowPhoneBoardHint\(\{[\s\S]*?isSessionOwner: isSessionOwner\.value,[\s\S]*?isLocalWorkspace,[\s\S]*?dismissed: phoneHintDismissed\.value,/)
  })

  it('«Зрозуміло» веде в кабінет, «Все одно відкрити» запам’ятовує вибір', () => {
    expect(src).toMatch(/function onPhoneHintUnderstood\(\)[\s\S]*?router\.push\('\/tutor'\)/)
    expect(src).toMatch(/function onPhoneHintOpenAnyway\(\)[\s\S]*?rememberPhoneBoardHintDismissed\(\)[\s\S]*?phoneHintDismissed\.value = true/)
  })
})
