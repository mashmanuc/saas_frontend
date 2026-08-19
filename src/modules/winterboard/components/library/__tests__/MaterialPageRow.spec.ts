import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'
import MaterialPageRow from '../MaterialPageRow.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const page = (over = {}) => ({
  page_no: 20,
  text: '2.4. Як знайти число, 60% якого дорівнюють 360?',
  source: 'ocr' as const,
  evidence: 'inferred' as const,
  status: 'done' as const,
  error: '',
  model: 'mistral-ocr-latest',
  tokens: 0,
  warnings: [],
  blocks_count: 12,
  needs_review: true,
  confirmed_at: null,
  updated_at: '2026-08-19T00:00:00Z',
  ...over,
})

const mountRow = (over = {}) =>
  mount(MaterialPageRow, { props: { page: page(over) }, global: { plugins: [i18n] } })

const confirmBtn = (w: ReturnType<typeof mountRow>) => w.find('.material-page__confirm-btn')

describe('MaterialPageRow · підтвердження лише після читання', () => {
  it('кнопка неактивна, доки текст згорнутий', () => {
    // Ворота 6-2 існують тому, що роздільника рукопису немає і людина —
    // єдиний роздільник. Підтвердити не читаючи = зробити ворота кліканням.
    const w = mountRow()
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
  })

  it('після розгортання стає активною', async () => {
    const w = mountRow()
    await w.find('.material-page__toggle').trigger('click')
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
  })

  it('текст показується лише розгорнутим', async () => {
    // Перевіряємо саме `style`, а не `isVisible()`: у цій версії
    // vue-test-utils хелпер повертає true навіть при `display: none`
    // (перевірено — атрибут виставлений правильно). Тест має міряти
    // компонент, а не баг хелпера.
    const w = mountRow()
    expect(w.find('.material-page__text').attributes('style')).toContain('display: none')
    await w.find('.material-page__toggle').trigger('click')
    expect(w.find('.material-page__text').attributes('style') || '')
      .not.toContain('display: none')
  })

  it('підтверджена сторінка не пропонує підтвердити вдруге', async () => {
    const w = mountRow({ confirmed_at: '2026-08-19T10:00:00Z' })
    await w.find('.material-page__toggle').trigger('click')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Підтверджено')
  })

  it('невдала сторінка не підтверджується', async () => {
    const w = mountRow({ status: 'failed', error: 'ocr_failed' })
    await w.find('.material-page__toggle').trigger('click')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
  })

  it('емітить номер сторінки, а не «всі»', async () => {
    const w = mountRow()
    await w.find('.material-page__toggle').trigger('click')
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([20])
  })

  it('a11y: кнопка розгортання має aria-expanded', async () => {
    const w = mountRow()
    const toggle = w.find('.material-page__toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })
})

describe('MaterialPageRow · ніде не «перевірено»', () => {
  it('машинне читання підписано для ocr', () => {
    const w = mountRow()
    expect(w.find('.material-page__machine').text()).toContain('можливі помилки')
  })

  it('підпис стоїть навіть без попереджень', () => {
    // Порожній `warnings` означає «наші перевірки нічого не знайшли», а не
    // «тут усе правильно»: OCR дав 98.87 %, і це не 100 (C2).
    const w = mountRow({ warnings: [] })
    expect(w.find('.material-page__machine').exists()).toBe(true)
  })

  it('текстовий шар підпису не потребує', () => {
    const w = mountRow({ source: 'text_layer', evidence: 'verified', needs_review: false })
    expect(w.find('.material-page__machine').exists()).toBe(false)
  })

  it('слова «перевірено» немає ніде', () => {
    for (const src of ['text_layer', 'vision', 'ocr'] as const) {
      const w = mountRow({ source: src, needs_review: src !== 'text_layer' })
      expect(w.text().toLowerCase()).not.toContain('перевірено')
    }
  })

  it('джерело названо людською мовою', () => {
    expect(mountRow({ source: 'ocr' }).text()).toContain('розпізнано OCR')
    expect(mountRow({ source: 'text_layer' }).text()).toContain('текстового шару')
  })
})

describe('MaterialPageRow · дефект і мітка виглядають по-різному', () => {
  const defect = {
    code: 'script_collapsed' as const,
    block_index: 1,
    detail: 'у блоці латиниці більше за кирилицю',
    sample: '2.19. BknaHnK BnIc 0 6aHky 1000 rpn',
  }
  const mark = {
    code: 'formula_block' as const,
    block_index: 2,
    detail: 'блок містить формульну тотожність',
    sample: '(a^m)^n = a^(m·n)',
  }

  it('дефект показується як попередження зі зразком', () => {
    const w = mountRow({ warnings: [defect] })
    const box = w.find('.material-page__warning')
    expect(box.exists()).toBe(true)
    expect(box.find('.material-page__sample').text()).toContain('BknaHnK')
  })

  it('formula_block НЕ потрапляє в попередження', () => {
    // Це мітка класу «теорія», а не дефект. Малювати однаково — брехня.
    const w = mountRow({ warnings: [mark] })
    expect(w.find('.material-page__warning').exists()).toBe(false)
    expect(w.find('.material-page__theory').exists()).toBe(true)
  })

  it('мітка теорії рахує блоки', () => {
    const w = mountRow({ warnings: [mark, { ...mark, block_index: 3 }] })
    expect(w.find('.material-page__theory').text()).toContain('2')
  })

  it('дефект і мітка на одній сторінці розведені', () => {
    const w = mountRow({ warnings: [defect, mark] })
    expect(w.findAll('.material-page__warning')).toHaveLength(1)
    expect(w.find('.material-page__theory').exists()).toBe(true)
  })
})
