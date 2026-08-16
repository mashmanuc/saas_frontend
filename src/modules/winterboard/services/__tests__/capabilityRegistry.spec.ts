/**
 * capabilityRegistry — кнопка «Побудувати» обіцяє лише те, що зробить.
 *
 * Живий прогін власника 2026-08-16 («кнопка "Побудувати" не працює»):
 * задача про вектори у ПЛОСКОМУ трикутнику мала intents
 * ['show_vectors_2d', 'show_vectors_3d'] і extracted_data = {}. 2D-гілку
 * guard відсіяв чесно (нема shape_2d) — а 3D-гілка guard'а НЕ МАЛА. Кнопка
 * з'явилась, клік дійшов, buildCompanionData повернув null (без shape тіла
 * немає — ТЗ D-4, ваш же «куб-самозванець гірший за порожнечу»), і нічого
 * не сталось. Мовчки.
 *
 * Вимір по банку: 891 задача з 3D-інтентом, з них 226 без shape — чверть
 * 3D-кнопок брехала. Не разовий випадок, а асиметрія guard'ів.
 *
 * INV-CAP-1: рішення «який renderer» — ТІЛЬКИ тут. Тому й тест тут, а не в
 * spawn-обробнику: якщо кнопка є, companion мусить створитись.
 */
import { describe, it, expect } from 'vitest'
import {
  hasAvailableCompanions,
  resolveCompanions,
} from '../capabilityRegistry'

describe('nmt3d потребує shape — як geometry_2d_v2 потребує shape_2d', () => {
  it('живий кейс власника: вектори у трикутнику, extracted={} → кнопки НЕМАЄ', () => {
    // Дослівний fingerprint задачі nmt-oa-2628 з банку.
    const intents = ['show_vectors_2d', 'show_vectors_3d']
    const entities = ['vector_2d', 'vector_3d']
    expect(hasAvailableCompanions(intents, {}, entities)).toBe(false)
    expect(resolveCompanions(intents, {}, entities)).toEqual([])
  })

  it('3D-задача ЗІ shape — кнопка є, як і має бути (не зламати чесні 665)', () => {
    const r = resolveCompanions(['show_3d_solid'], { shape: 'pyramid' }, ['pyramid'])
    expect(r.map((x) => x.rendererType)).toEqual(['nmt3d'])
  })

  it('shape порожній рядок — те саме, що відсутній', () => {
    expect(hasAvailableCompanions(['show_3d_solid'], { shape: '' }, [])).toBe(false)
  })

  it('shape не рядок (сміття екстрактора) — не пропускаємо', () => {
    expect(hasAvailableCompanions(['show_3d_solid'], { shape: 42 }, [])).toBe(false)
    expect(hasAvailableCompanions(['show_3d_solid'], { shape: null }, [])).toBe(false)
  })

  it('усі чотири 3D-інтенти під одним guard-ом', () => {
    for (const intent of ['show_3d_solid', 'show_cross_section',
                          'animate_rotation', 'show_vectors_3d']) {
      expect(hasAvailableCompanions([intent], {}, []), intent).toBe(false)
      expect(hasAvailableCompanions([intent], { shape: 'cube' }, []), intent).toBe(true)
    }
  })
})

describe('симетрія з 2D (регресія ТЗ-F, щоб не зламати вже зроблене)', () => {
  it('2D без shape_2d — кнопки немає', () => {
    expect(hasAvailableCompanions(['show_2d_shape'], {}, [])).toBe(false)
  })

  it('2D зі shape_2d — кнопка є', () => {
    expect(hasAvailableCompanions(['show_2d_shape'], { shape_2d: 'triangle' }, [])).toBe(true)
  })

  it('обидва інтенти, дані лише для 2D → рівно один companion, і це 2D', () => {
    const r = resolveCompanions(['show_vectors_2d', 'show_vectors_3d'],
                                { shape_2d: 'triangle' }, [])
    expect(r.map((x) => x.rendererType)).toEqual(['geometry_2d_v2'])
  })
})
