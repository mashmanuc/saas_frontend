import { describe, it, expect } from 'vitest'
import { detectCardPreset } from '../detectCardPreset'

describe('detectCardPreset — FE-дзеркало BE _detect_preset', () => {
  it('живий кейс власника 2026-08-07: title перемагає body', () => {
    // Картка «Поширена помилка: скорочення дробів» вийшла зеленою (rule),
    // бо тіло закінчувалось «✅ Правило: …». Заголовок мусить вирішувати.
    expect(detectCardPreset(
      'Поширена помилка: скорочення дробів',
      'Найчастіша помилка — скорочувати доданки…\n✅ Правило: «Скорочуємо тільки множники».',
      'Нотатка',
    )).toBe('common mistake')
  })

  it('badge перемагає title', () => {
    expect(detectCardPreset('Правило множення', '', 'Алгоритм')).toBe('algorithm')
  })

  it('означення/теорія → definition', () => {
    expect(detectCardPreset('Означення похідної', '', '')).toBe('definition')
    expect(detectCardPreset('Теорія ймовірностей', '', '')).toBe('definition')
  })

  it('таблиця → example (старі картки «Таблиця …» перефарбуються)', () => {
    expect(detectCardPreset('Таблиця похідних', '', '')).toBe('example')
  })

  it('«приклад із життя» не з’їдається коротшим «приклад»', () => {
    expect(detectCardPreset('', 'приклад із життя про відсотки', '')).toBe('life example')
  })

  it('без збігів → null (картка з дефолтним стилем)', () => {
    expect(detectCardPreset('Формули скороченого множення', '(a+b)²=…', '')).toBeNull()
    expect(detectCardPreset('', '', '')).toBeNull()
  })

  it('регістронезалежність', () => {
    expect(detectCardPreset('АЛГОРИТМ Евкліда', '', '')).toBe('algorithm')
  })
})
