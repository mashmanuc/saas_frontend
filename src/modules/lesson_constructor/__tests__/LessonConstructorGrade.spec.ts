/**
 * Вибір теми «За класом» (власник 2026-10-21: «зовсім незручно для користувача шукати тему від конкретного учня.
 * Йому треба по класах, або по темах, або пошук»; макет дизайнера «Вибір теми», варіант D).
 *
 * Стереже:
 *   1. Перший раз — лише вибір класу; дерево тем НМТ — під кнопкою «НМТ», з пошуком.
 *   2. Клас → розділи програми з реєстру (не вигаданий список), у порядку календарних планів.
 *   3. Розділ з однією темою обирає її одразу; з кількома — питає «про що саме», і в генератор іде саме вона.
 *   4. Кожна тема з реєстру програми існує серед тем конструктора (інакше розділ вів би в нікуди).
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_body: Record<string, any>) => ({ session_id: 'sess-1' })),
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api/lessonConstructorApi', async () => {
  const actual = await vi.importActual<any>('../api/lessonConstructorApi')
  return { ...actual, lessonConstructorApi: { generate } }
})

import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'
import { CURRICULUM, GRADES } from '../curriculum'
import { filterUnits, gradeTracks, loadTopicView, searchTopics } from '../topicByGrade'

const LABELS: Record<string, string> = Object.fromEntries(TOPICS.map((t: any) => [t.value, t.label]))
const unitButtons = (w: any) => w.findAll('.tgp-unit')
const unit = (w: any, title: string) => unitButtons(w).find((b: any) => b.find('.tgp-unit__title').text() === title)

async function generated(w: any) {
  await w.find('.lc-btn-generate').trigger('submit')
  await new Promise((r) => setTimeout(r, 0))
  return generate.mock.calls[generate.mock.calls.length - 1]![0]
}

beforeEach(() => {
  localStorage.clear()
  generate.mockClear()
  push.mockClear()
})

describe('вибір теми за класом — сторінка конструктора', () => {
  it('перший раз: рядок класів 5–11 і «НМТ», підказка обрати клас, дерева тем немає', () => {
    const w = mount(LessonConstructorPage)
    expect(w.findAll('.tgp-grade').map((b: any) => b.text())).toEqual([
      '5клас', '6клас', '7клас', '8клас', '9клас', '10клас', '11клас', 'НМТусі теми'])
    expect(w.text()).toContain('Оберіть клас учня')
    expect(w.find('.lc-topic-block').exists()).toBe(false)
  })

  it('клас → розділи програми в порядку планів; вибір класу запам’ятовується', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-5"]').trigger('click')
    const expected = CURRICULUM.filter((u) => u.grade === 5).map((u) => u.title)
    expect(unitButtons(w).map((b: any) => b.find('.tgp-unit__title').text())).toEqual(expected)
    expect(w.find('.tgp-track__head').text()).toContain('Математика')
    expect(loadTopicView()).toBe(5)
  })

  it('7 клас — дві колонки: алгебра, потім геометрія', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-7"]').trigger('click')
    expect(w.findAll('.tgp-track__head').map((h: any) => h.find('span').text())).toEqual(['Алгебра', 'Геометрія'])
  })

  it('розділ з однією темою обирає її одразу — у генератор іде саме вона', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-5"]').trigger('click')
    await unit(w, 'Натуральні числа').trigger('click')
    expect(w.find('[data-testid="topic-picked"]').text()).toBe('Урок про: Натуральні числа')
    expect((await generated(w)).topics).toEqual(['real-numbers.natural'])
  })

  it('розділ з кількома темами питає «про що саме»: «Десяткові дроби» — урок саме про них', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-5"]').trigger('click')
    await unit(w, 'Дробові числа і дії з ними').trigger('click')
    expect(w.text()).toContain('Про що саме урок?')
    expect(w.findAll('.tgp-chip').map((c: any) => c.text())).toEqual([
      'Дроби', 'Звичайні дроби', 'Десяткові дроби', 'Додавання і віднімання десяткових дробів',
      'Множення і ділення десяткових дробів', 'Порядок дій із десятковими дробами'])
    expect(generate).not.toHaveBeenCalled()
    await w.find('[data-testid="topic-refine-real-numbers.fractions.decimal"]').trigger('click')
    expect(w.find('[data-testid="topic-picked"]').text()).toBe('Урок про: Десяткові дроби')
    expect((await generated(w)).topics).toEqual(['real-numbers.fractions.decimal'])
  })

  // Власник 2026-10-21 після уроків: «Вибрав тему додавання-віднімання дроби з різними знаменниками. Хер зна що
  // чомусь дало» і «виділяється 2» — обидва розділи 6 класу вели в широкі «Звичайні дроби».
  it('6 клас: «Додавання і віднімання звичайних дробів» — урок саме про це, світиться лише цей розділ', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-6"]').trigger('click')
    await unit(w, 'Додавання і віднімання звичайних дробів').trigger('click')
    expect(w.find('[data-testid="topic-picked"]').text())
      .toBe('Урок про: Додавання і віднімання дробів з різними знаменниками')
    expect(w.findAll('.tgp-unit--on').map((b: any) => b.find('.tgp-unit__title').text()))
      .toEqual(['Додавання і віднімання звичайних дробів'])
    expect((await generated(w)).topics).toEqual(['real-numbers.fractions.ordinary.add-subtract'])
    await unit(w, 'Множення і ділення звичайних дробів').trigger('click')
    expect((await generated(w)).topics).toEqual(['real-numbers.fractions.ordinary.multiply-divide'])
  })

  it('та сама тема у двох розділах — світиться лише той, з якого обрали', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-7"]').trigger('click')
    await unit(w, 'Трикутники. Ознаки рівності трикутників').trigger('click')
    await w.find('[data-testid="topic-refine-triangles"]').trigger('click')
    expect(w.findAll('.tgp-unit--on').map((b: any) => b.find('.tgp-unit__title').text()))
      .toEqual(['Трикутники. Ознаки рівності трикутників'])
  })

  it('інший розділ замінює вибір — тема одна', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-5"]').trigger('click')
    await unit(w, 'Натуральні числа').trigger('click')
    await unit(w, 'Подільність натуральних чисел').trigger('click')
    expect((await generated(w)).topics).toEqual(['real-numbers.divisibility'])
  })

  it('пошук у класі: за назвою розділу і за назвою теми (розділ із нею розкривається)', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-5"]').trigger('click')
    await w.find('[data-testid="topic-grade-search"]').setValue('подільн')
    expect(unitButtons(w).map((b: any) => b.find('.tgp-unit__title').text())).toEqual(['Подільність натуральних чисел'])
    await w.find('[data-testid="topic-grade-search"]').setValue('десятков')
    expect(unitButtons(w).map((b: any) => b.find('.tgp-unit__title').text())).toEqual(['Дробові числа і дії з ними'])
    expect(w.find('[data-testid="topic-refine-real-numbers.fractions.decimal"]').exists()).toBe(true)
  })

  it('«НМТ»: дерево тем, як було, і пошук по всіх темах', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-nmt"]').trigger('click')
    expect(w.findAll('.lc-topic-block').length).toBeGreaterThan(0)
    await w.find('[data-testid="topic-search"]').setValue('логарифм')
    const hits = w.findAll('.lc-topic-hit')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h: any) => h.find('.lc-topic-hit__label').text().toLowerCase().includes('логарифм'))).toBe(true)
    expect(w.find('.lc-topic-block').exists()).toBe(false)
    await hits[0].trigger('click')
    expect((await generated(w)).topics).toEqual([hits[0].attributes('data-testid')!.replace('topic-hit-', '')])
  })

  it('пошук без збігів — так і каже', async () => {
    const w = mount(LessonConstructorPage)
    await w.find('[data-testid="topic-grade-nmt"]').trigger('click')
    await w.find('[data-testid="topic-search"]').setValue('щшщшщ')
    expect(w.text()).toContain('Нічого не знайдено')
  })
})

describe('вибір теми за класом — дані', () => {
  it('кожна тема реєстру програми є серед тем конструктора', () => {
    const missing = CURRICULUM.flatMap((u) => u.topics).filter((id) => !LABELS[id])
    expect(missing).toEqual([])
  })

  it('у кожному класі є розділи; 5–6 — «Математика», 7–11 — алгебра й геометрія', () => {
    for (const g of GRADES) {
      const tracks = gradeTracks(g, LABELS).map((t) => t.track)
      expect(tracks).toEqual(g <= 6 ? ['math'] : ['algebra', 'geometry'])
    }
  })

  it('однакові назви тем у розділі не повторюються; номери — підряд, як у плані', () => {
    for (const g of GRADES) {
      for (const t of gradeTracks(g, LABELS)) {
        expect(t.units.map((u) => u.no)).toEqual(t.units.map((_, i) => i + 1))
        for (const u of t.units) {
          const names = u.topics.map((id) => LABELS[id])
          expect(new Set(names).size).toBe(names.length)
        }
      }
    }
  })

  it('пошук без огляду на регістр; порожній пошук нічого не відкидає', () => {
    const units = gradeTracks(5, LABELS)[0].units
    expect(filterUnits(units, '', LABELS)).toEqual(units)
    expect(filterUnits(units, 'ДЕСЯТКОВІ', LABELS).map((u) => u.title)).toEqual(['Дробові числа і дії з ними'])
    expect(searchTopics(TOPICS, '')).toEqual([])
  })

  it('зламане сховище — просто без пам’яті вибору', () => {
    localStorage.setItem('lc.topicView', '42')
    expect(loadTopicView()).toBeNull()
    localStorage.setItem('lc.topicView', 'nmt')
    expect(loadTopicView()).toBe('nmt')
  })
})
