/**
 * «📋 Скопіювати картинку» на картці «Домашнє завдання» на дошці (власник 2026-10-20: «вчитель згенерував домашку
 * і додав на дошку, а учневі не скопіював — додати кнопку скопіювати, як у генераторі домашки»).
 * Та сама картинка, що у вікні домашки: сервер малює її за `taskIds` картки; кнопка лише у власника дошки.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import TheoryCardRenderer from '../components/board/objects/TheoryCardRenderer.vue'
import { provideHomeworkCopyBoard } from '../composables/homeworkCopy'
import type { WBAsset } from '../types/winterboard'

const { homeworkImage } = vi.hoisted(() => ({ homeworkImage: vi.fn() }))
vi.mock('@/modules/intent/homeworkApi', () => ({ homeworkImage }))
vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const HOMEWORK = {
  version: 1, badge: 'Домашнє завдання', title: 'Урок: Первісна', body: '1. …', formulas: [],
  items: ['Задано функцію $f(x)=15x^4$.', 'Знайдіть $F(6)$.'], taskIds: ['nmt-1', 'nmt-2'],
}

function card(data: Record<string, unknown>) {
  return { id: 'hw1', type: 'theory_card', src: '', x: 0, y: 0, w: 1200, h: 400, rotation: 0, locked: false, data } as unknown as WBAsset
}

/** Кімната: власник дошки → id; учень, запис уроку, поза кімнатою → без id. */
function mountIn(boardId: string | null | undefined, data: Record<string, unknown> = HOMEWORK, interactive = true) {
  const Room = defineComponent({
    setup() {
      if (boardId !== undefined) provideHomeworkCopyBoard(ref(boardId))
      return () => h(TheoryCardRenderer, { asset: card(data), interactive })
    },
  })
  return mount(Room, { global: { plugins: [i18n()] } })
}

const write = vi.fn()
beforeEach(() => {
  homeworkImage.mockReset()
  write.mockReset()
  ;(globalThis as any).ClipboardItem = class { constructor(public items: Record<string, unknown>) {} }
  Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
  ;(URL as any).createObjectURL = vi.fn(() => 'blob:hw')
  ;(URL as any).revokeObjectURL = vi.fn()
})
afterEach(() => { delete (globalThis as any).ClipboardItem })

describe('картка домашки на дошці · «📋 Скопіювати картинку»', () => {
  it('власник одним натиском кладе в буфер ту саму картинку, що й у вікні домашки', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    homeworkImage.mockReturnValue(Promise.resolve(png))
    const w = mountIn('board-1')
    const btn = w.get('[data-testid="theory-card-hw-copy"]')
    expect(btn.text()).toBe('📋 Скопіювати картинку')
    expect(btn.attributes('data-export-hide')).toBeDefined()          // у PDF-експорт дошки не потрапляє
    await btn.trigger('click')
    await flushPromises()
    expect(homeworkImage).toHaveBeenCalledWith({ boardId: 'board-1', ids: ['nmt-1', 'nmt-2'] })
    expect(write).toHaveBeenCalledTimes(1)
    expect(await write.mock.calls[0][0][0].items['image/png']).toBe(png)
    expect(w.get('[data-testid="theory-card-hw-copy"]').text()).toContain('Скопійовано')
  })

  it('клікається й з олівцем — як «Джерело»', async () => {
    homeworkImage.mockReturnValue(Promise.resolve(new Blob(['png'])))
    const w = mountIn('board-1', HOMEWORK, false)
    await w.get('[data-testid="theory-card-hw-copy"]').trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('учень, запис уроку чи поза кімнатою — кнопки немає', () => {
    expect(mountIn(null).find('[data-testid="theory-card-hw-copy"]').exists()).toBe(false)
    expect(mountIn(undefined).find('[data-testid="theory-card-hw-copy"]').exists()).toBe(false)
  })

  it('картка без задач банку (стара) і звичайна картка теорії — без кнопки', () => {
    const { taskIds: _drop, ...noIds } = HOMEWORK
    expect(mountIn('board-1', noIds).find('[data-testid="theory-card-hw-copy"]').exists()).toBe(false)
    expect(mountIn('board-1', { version: 1, title: 'Похідна', body: 'Текст.', formulas: [] })
      .find('[data-testid="theory-card-hw-copy"]').exists()).toBe(false)
  })

  it('буфер для картинок недоступний — посилання «Завантажити картинку»', async () => {
    delete (globalThis as any).ClipboardItem
    homeworkImage.mockReturnValue(Promise.resolve(new Blob(['png'])))
    const w = mountIn('board-1')
    await w.get('[data-testid="theory-card-hw-copy"]').trigger('click')
    await flushPromises()
    const link = w.get('[data-testid="theory-card-hw-download"]')
    expect(link.attributes('href')).toBe('blob:hw')
    expect(link.text()).toBe('Завантажити картинку')
  })

  it('сервер відмовив — учитель бачить його пояснення, а не тишу', async () => {
    const detail = 'Частини задач уже немає в банку — запропонуйте домашку ще раз.'
    const body = new Blob([JSON.stringify({ detail })], { type: 'application/json' })
    const failed = Promise.reject({ response: { status: 400, data: body } })
    failed.catch(() => {})
    homeworkImage.mockReturnValue(failed)
    write.mockImplementation(async (items: any[]) => { await items[0].items['image/png'] })
    const w = mountIn('board-1')
    await w.get('[data-testid="theory-card-hw-copy"]').trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    expect(w.get('[data-testid="theory-card-hw-error"]').text()).toBe(detail)
  })
})
