// Глядач бачить повну картку, але нічого не пише.
//
// Власник 2026-09-25, запис уроку: у Replay картки обрізані, зі смугою
// прокрутки, хоча на живій дошці той самий текст поміщається. Причина — ми
// звели два різні права до одного прапорця: INV-25 п.8 забороняє глядачеві
// ПИСАТИ авто-висоту, а ми заборонили йому навіть МІРЯТИ. Замір — це робота
// показу; операцій він не породжує.
import { describe, expect, it } from 'vitest'

import { planAutoFit } from '../composables/autoFitHeight'
import { canMeasureInMode, canWriteAutoFit } from '../components/canvas/overlayRegistry'

/** Картка на 380, вмісту треба 520 екранних пікселів при зумі 1. */
const NEEDS_MORE = { neededPx: 520, zoom: 1, y: 100, h: 380, pageH: 1080, lastAutoH: 380 }

describe('авто-висота: писати чи лише показати', () => {
  it('учитель у редагуванні — операція, як і було', () => {
    const out = planAutoFit({ ...NEEDS_MORE, canWrite: true })

    expect(out.write).toBe(520)
    expect(out.display).toBeNull()
  })

  it('Replay і учень — лише показ, жодної операції', () => {
    for (const mode of ['replay', 'view']) {
      const canWrite = canWriteAutoFit(mode, true)
      expect(canWrite, `${mode}: писати не можна`).toBe(false)

      const out = planAutoFit({ ...NEEDS_MORE, canWrite })
      expect(out.write, `${mode}: операції бути не повинно`).toBeNull()
      expect(out.display, `${mode}: показати повну висоту`).toBe(520)
    }
  })

  it('учень у класі (mode=edit, але не вчитель) — теж лише показ', () => {
    const out = planAutoFit({ ...NEEDS_MORE, canWrite: canWriteAutoFit('edit', false) })

    expect(out.write).toBeNull()
    expect(out.display).toBe(520)
  })

  it('міряти може будь-який клієнт — інакше глядач не дізнається потрібної висоти', () => {
    expect(canMeasureInMode()).toBe(true)
  })

  it('коли міняти нічого не треба — ні операції, ні показу', () => {
    const out = planAutoFit({ ...NEEDS_MORE, neededPx: 381, canWrite: false })

    expect(out).toEqual({ write: null, display: null })
  })

  it('межа сторінки діє й для показу: картка не вилазить за аркуш', () => {
    const out = planAutoFit({
      neededPx: 1500, zoom: 1, y: 900, h: 150, pageH: 1080, lastAutoH: 150, canWrite: false,
    })

    expect(out.display).toBe(180)
  })
})
