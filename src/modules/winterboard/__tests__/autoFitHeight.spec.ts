/**
 * Автопідгонка висоти картки — правила з рішення власника 2026-09-09.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * Симптом був такий: учитель збільшує шрифт розбору, картка лишається тієї
 * самої висоти й вмикає внутрішній скрол — при тому що під нею порожня
 * сторінка. Скрол мав бути крайнім засобом, а не першою реакцією.
 *
 * Тут перевіряється саме рішення, а не малювання: воно чисте, тож ловиться
 * тестом, а не оком на дошці.
 *
 * ІНВАРІАНТИ
 *   INV-FIT-1  вміст не влазить → висота росте
 *   INV-FIT-2  ріст лише вниз і лише до низу полотна (`y` не змінюється)
 *   INV-FIT-3  місця більше немає → висота впирається в межу (далі скрол)
 *   INV-FIT-4  ручну висоту не затираємо: від неї можна тільки рости
 *   INV-FIT-5  свою висоту можна стиснути, коли шрифт зменшили
 *   INV-FIT-6  мікрозміна не породжує операції
 *   INV-FIT-7  вміст міряється в пікселях екрана, геометрія — в координатах дошки
 */
import { describe, expect, it } from 'vitest'
import { AUTO_FIT_MIN_H, nextAutoFitHeight } from '../composables/autoFitHeight'

const base = { zoom: 1, y: 100, h: 300, pageH: 1080 }

describe('nextAutoFitHeight', () => {
  it('INV-FIT-1: вміст вищий за картку → нова висота дорівнює потребі', () => {
    expect(nextAutoFitHeight({ ...base, neededPx: 460, lastAutoH: 300 })).toBe(460)
  })

  it('INV-FIT-2: стеля — відстань до низу полотна, а не висота полотна', () => {
    // y=800, pageH=1080 → вниз лишилось 280, хоч вмісту треба 900.
    expect(nextAutoFitHeight({ ...base, y: 800, h: 200, neededPx: 900, lastAutoH: 200 }))
      .toBe(280)
  })

  it('INV-FIT-3: картка вже впирається в низ → змін немає, далі скрол', () => {
    expect(nextAutoFitHeight({ ...base, y: 800, h: 280, neededPx: 900, lastAutoH: 280 }))
      .toBeNull()
  })

  it('INV-FIT-4: ручну висоту не затираємо — лише ростимо від неї', () => {
    // Учитель розтягнув до 600 (autoFitH лишився 300). Вмісту треба 400 —
    // стискати до 400 не можна, це була б втрата його дії.
    expect(nextAutoFitHeight({ ...base, h: 600, neededPx: 400, lastAutoH: 300 })).toBeNull()
    // А якщо вмісту треба більше за ручну — росте.
    expect(nextAutoFitHeight({ ...base, h: 600, neededPx: 700, lastAutoH: 300 })).toBe(700)
  })

  it('INV-FIT-4-bis: висоти ще ніхто не підганяв → теж тільки ріст', () => {
    expect(nextAutoFitHeight({ ...base, h: 500, neededPx: 300 })).toBeNull()
    expect(nextAutoFitHeight({ ...base, h: 500, neededPx: 640 })).toBe(640)
  })

  it('INV-FIT-5: свою висоту стискаємо, коли шрифт зменшили', () => {
    expect(nextAutoFitHeight({ ...base, h: 600, neededPx: 320, lastAutoH: 600 })).toBe(320)
  })

  it('INV-FIT-5-bis: стискаємо не нижче мінімуму читабельності', () => {
    expect(nextAutoFitHeight({ ...base, h: 600, neededPx: 20, lastAutoH: 600 }))
      .toBe(AUTO_FIT_MIN_H)
  })

  it('INV-FIT-6: різниця в один піксель не варта операції', () => {
    expect(nextAutoFitHeight({ ...base, h: 300, neededPx: 301, lastAutoH: 300 })).toBeNull()
  })

  it('INV-FIT-7: зум переводить пікселі екрана в координати дошки', () => {
    // На зумі 2 картка вдвічі більша на екрані, тож 800 px екрана = 400 дошки.
    expect(nextAutoFitHeight({ ...base, zoom: 2, neededPx: 800, lastAutoH: 300 })).toBe(400)
    // На зумі 0.5 — навпаки.
    expect(nextAutoFitHeight({ ...base, zoom: 0.5, neededPx: 200, lastAutoH: 300 })).toBe(400)
  })

  it('нульовий чи зіпсований вимір ігнорується', () => {
    expect(nextAutoFitHeight({ ...base, neededPx: 0 })).toBeNull()
    expect(nextAutoFitHeight({ ...base, neededPx: Number.NaN })).toBeNull()
  })
})
