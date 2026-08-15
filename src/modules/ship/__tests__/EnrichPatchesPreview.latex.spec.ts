/**
 * І-3: у прев'ю enrich формули мають виглядати так само, як потім на дошці.
 *
 * Знахідка власника 2026-08-10: список показував сирий `$\frac{k}{x+b}$`,
 * тобто тьютор оцінював картку по ГІРШОМУ вигляду, ніж вона матиме після
 * застосування (на дошці той самий `body` рендериться через
 * `renderTextWithLatex` у TheoryCardRenderer).
 *
 * Тест перевіряє РЕЗУЛЬТАТ (у DOM є KaTeX, немає сирого LaTeX), а не
 * механізм — переживе зміну способу рендеру.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const enrich = vi.fn()

vi.mock('../shipApi', () => ({
  shipApi: {
    enrich: (...args: unknown[]) => enrich(...args),
    enrichApply: vi.fn(),
  },
}))
vi.mock('@/modules/winterboard/stores/opsSyncStore', () => ({
  useOpsSyncStore: () => ({ catchUp: vi.fn().mockResolvedValue({ status: 'applied', lastSeq: 1 }) }),
}))
vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({ applyCatchUpState: vi.fn() }),
}))

import EnrichPatchesPreview from '../EnrichPatchesPreview.vue'
import uk from '@/i18n/locales/uk.json'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function mountPreview() {
  return mount(EnrichPatchesPreview, {
    props: { artifactId: 'a1', visible: true },
    global: { plugins: [i18n] },
  })
}

async function runWith(patch: Record<string, unknown>) {
  enrich.mockResolvedValue({
    patches: [patch], error: null, processed_tasks: 1, total_tasks: 1,
    failed_task_refs: [], skipped: [],
  })
  const wrapper = mountPreview()
  const ta = wrapper.find('textarea').element as HTMLTextAreaElement
  ta.value = 'додай формули'
  // Кнопка запуску має ЯВНИЙ клас `__run` (рев'ю 2026-08-15: блок інструкції
  // став композером із чіпами й мікрофоном, тож старий селектор
  // `.enrich-patches-preview__input button` ловив би тепер чіп або мік).
  await wrapper.find('.enrich-patches-preview__run').trigger('click')
  await flushPromises()
  return wrapper
}

describe('EnrichPatchesPreview — LaTeX у прев\'ю', () => {
  beforeEach(() => {
    enrich.mockReset()
    setActivePinia(createPinia())
  })

  it('формула в тілі стає KaTeX, а не лишається сирим текстом', async () => {
    const wrapper = await runWith({
      task_ref: '1', action: 'add_card', latex_valid: true, latex_error: '',
      card_data: {
        title: 'Дробово-раціональна',
        body: 'Функція $\\frac{k}{x+b}$ не визначена там, де знаменник нуль.',
        badge: 'Теорія',
      },
    })

    const preview = wrapper.find('.enrich-patches-preview__preview')
    expect(preview.html()).toContain('katex')
    // ⚠️ Перевіряємо саме ВИДИМИЙ шар (.katex-html). Загальний textContent
    // не годиться: режим `htmlAndMathml` додає прихований MathML з
    // <annotation>\frac{k}{x+b}</annotation> для скрінрідерів — сирий
    // LaTeX там присутній ЗА ЗАДУМОМ і не є дефектом.
    const visible = preview.element.querySelector('.katex-html')
    expect(visible).not.toBeNull()
    expect(visible!.textContent || '').not.toContain('\\frac')
  })

  it('формула в заголовку теж рендериться', async () => {
    const wrapper = await runWith({
      task_ref: '1', action: 'add_card', latex_valid: true, latex_error: '',
      card_data: { title: 'Похідна $x^2$', body: 'текст', badge: 'Теорія' },
    })
    expect(wrapper.find('.enrich-patches-preview__preview strong').html()).toContain('katex')
  })

  it('HTML у відповіді LLM екранується, а не виконується', async () => {
    // Ключова перевірка безпеки: v-html тут дозволений ЛИШЕ тому, що
    // renderTextWithLatex екранує розмітку перед вставкою формул.
    const wrapper = await runWith({
      task_ref: '1', action: 'add_card', latex_valid: true, latex_error: '',
      card_data: {
        title: 'Тест',
        body: '<img src=x onerror="alert(1)"> і <script>alert(2)</script>',
        badge: 'Теорія',
      },
    })
    const preview = wrapper.find('.enrich-patches-preview__preview')
    expect(preview.element.querySelector('img')).toBeNull()
    expect(preview.element.querySelector('script')).toBeNull()
    expect(preview.text()).toContain('onerror')   // лишилось видимим текстом
  })

  it('текст без формул не ламається', async () => {
    const wrapper = await runWith({
      task_ref: '1', action: 'add_card', latex_valid: true, latex_error: '',
      card_data: { title: 'Звичайний', body: 'Просто текст без формул.', badge: 'Теорія' },
    })
    expect(wrapper.find('.enrich-patches-preview__preview').text())
      .toContain('Просто текст без формул.')
  })
})
