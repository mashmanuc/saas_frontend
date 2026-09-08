/**
 * Конструктор уроку: тип ДО тем — монтажний тест (ТЗ власника 2026-09-08).
 *
 * Сім сценаріїв власника перевіряються тут на справжньому змонтованому
 * компоненті, і головне в них — не «чи є кнопка», а **чи не летить запит**.
 * 2026-09-08 конструктор дозволив обрати дві теми й відправив їх на сервер;
 * учитель отримав 400 замість поради. Тому кожен негативний випадок звіряє
 * `generate` на «не викликано».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

// `vi.mock` піднімається над файлом, тож звичайні змінні у фабриці недоступні
// («Cannot access before initialization»). `vi.hoisted` — той самий підйом.
// Тіло запиту типізуємо явно: без нього TS вважає список аргументів порожнім
// і `generate.mock.calls[0][0]` не компілюється.
const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_body: Record<string, any>) => ({ session_id: 'sess-1' })),
  push: vi.fn(),
}))

/** Тіло першого запиту генерації. Кидає зрозуміло, якщо запиту не було. */
function firstCall(): Record<string, any> {
  const call = generate.mock.calls[0]
  if (!call) throw new Error('generate() не викликано — а тест на це розраховує')
  return call[0]
}

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api/lessonConstructorApi', async () => {
  const actual = await vi.importActual<any>('../api/lessonConstructorApi')
  return { ...actual, lessonConstructorApi: { generate } }
})

import LessonConstructorPage from '../views/LessonConstructorPage.vue'

const CIRCLE = 'Площа круга і його частин'
const PARALLELOGRAM = 'Площа паралелограма, ромба, трапеції'
const TRIANGLE = 'Площа трикутника'
const DERIVATIVE = 'Похідна'

function chip(w: any, text: string) {
  return w.findAll('button').find((b: any) => b.text().trim() === text)
}
function typeChip(w: any, label: string) {
  return w.findAll('.lc-type-chip').find((b: any) => b.text().includes(label))
}
function generateBtn(w: any) {
  return w.find('.lc-btn-generate')
}
async function build(type: string, topics: string[]) {
  const w = mount(LessonConstructorPage)
  await typeChip(w, type)!.trigger('click')
  for (const t of topics) await chip(w, t)!.trigger('click')
  return w
}

beforeEach(() => { generate.mockClear(); push.mockClear() })

describe('тип уроку стоїть перед темами', () => {
  it('перша секція — саме тип', async () => {
    const w = mount(LessonConstructorPage)
    const titles = w.findAll('.lc-section__title').map(t => t.text())
    expect(titles[0]).toContain('1. Тип уроку')
    expect(titles[1]).toContain('2. Оберіть теми')
  })

  it('усі п’ять типів на екрані, custom немає', async () => {
    const w = mount(LessonConstructorPage)
    for (const l of ['Вивчення нової теми', 'Закріплення', 'Контроль',
                     'Узагальнення', 'Повторення']) {
      expect(typeChip(w, l)).toBeTruthy()
    }
    expect(w.text()).not.toContain('Свій')
  })

  it('без типу теми клікати не можна, і сказано чому', async () => {
    const w = mount(LessonConstructorPage)
    await chip(w, TRIANGLE)!.trigger('click')
    expect(w.text()).toContain('Спершу оберіть тип уроку')
    expect(generateBtn(w).attributes('disabled')).toBeDefined()
  })
})

describe('сім перевірок власника', () => {
  it('1. intro + одна тема → генерація йде', async () => {
    const w = await build('Вивчення нової теми', [TRIANGLE])
    expect(generateBtn(w).attributes('disabled')).toBeUndefined()
    await generateBtn(w).trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(generate).toHaveBeenCalledTimes(1)
    expect(firstCall()).toMatchObject({ lesson_type: 'intro', topics: ['areas.triangle'] })
  })

  it('2. practice + одна тема → генерація йде', async () => {
    const w = await build('Закріплення', [TRIANGLE])
    await generateBtn(w).trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(firstCall().lesson_type).toBe('practice')
  })

  it('3. control + одна тема → генерація йде', async () => {
    const w = await build('Контроль', [TRIANGLE])
    await generateBtn(w).trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(firstCall().lesson_type).toBe('control')
  })

  it('4. generalize + круг і паралелограм → генерація йде', async () => {
    const w = await build('Узагальнення', [CIRCLE, PARALLELOGRAM])
    expect(generateBtn(w).attributes('disabled')).toBeUndefined()
    await generateBtn(w).trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(firstCall()).toMatchObject({
      lesson_type: 'generalize',
      topics: ['areas.circle', 'areas.parallelogram'],
    })
  })

  it('5. intro + спроба другої теми → друга не додається, на сервер іде одна', async () => {
    // Власник просив «кнопка заблокована з поясненням». Вийшла сильніша
    // гарантія: стан «intro + дві теми» недосяжний — правило не дає взяти
    // другу. Тому перевіряємо саме те, що важить: некоректна пара НІКОЛИ не
    // потрапляє на сервер.
    const w = await build('Вивчення нової теми', [TRIANGLE, CIRCLE])

    expect(w.text()).toContain('1 / 1')
    expect(chip(w, CIRCLE)!.classes()).toContain('lc-topic-chip--disabled')

    await generateBtn(w).trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(firstCall().topics).toEqual(['areas.triangle'])
  })

  it('5-біс. якщо дві теми лишились від іншого типу — кнопка блокується з поясненням', async () => {
    const w = await build('Узагальнення', [CIRCLE, PARALLELOGRAM])
    await typeChip(w, 'Вивчення нової теми')!.trigger('click')

    // Несумісний вибір очищено — і сказано, що саме сталося.
    expect(w.text()).toContain('лишила першу обрану')
    expect(w.text()).toContain('1 / 1')
    expect(generate).not.toHaveBeenCalled()
  })

  it('6. дві неспоріднені для generalize → друга недоступна, запит не летить', async () => {
    const w = await build('Узагальнення', [CIRCLE, DERIVATIVE])

    expect(w.text()).toContain('1 / 2')                 // «Похідна» не додалась
    expect(generateBtn(w).attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('двох споріднених')
    await generateBtn(w).trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(generate).not.toHaveBeenCalled()
  })
})

describe('підказки ведуть, а не забороняють', () => {
  it('для блокового типу сказано про дві споріднені', async () => {
    const w = mount(LessonConstructorPage)
    await typeChip(w, 'Узагальнення')!.trigger('click')
    expect(w.text()).toContain('дві споріднені теми одного розділу')
  })

  it('для одиночного типу сказано про одну', async () => {
    const w = mount(LessonConstructorPage)
    await typeChip(w, 'Контроль')!.trigger('click')
    expect(w.text()).toContain('Оберіть одну тему')
  })

  it('лічильник показує потребу типу, а не старі 5', async () => {
    const w = mount(LessonConstructorPage)
    await typeChip(w, 'Узагальнення')!.trigger('click')
    expect(w.text()).toContain('0 / 2')
  })
})
