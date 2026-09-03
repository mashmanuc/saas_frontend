import { describe, it, expect } from 'vitest'
import { matchRemotePhrase, REMOTE_GRAMMAR_MAX_LEN } from '../remote/remoteGrammar'

describe('remoteGrammar — голосові команди пульта', () => {
  it.each([
    ['далі', 'page.next'],
    ['Наступна', 'page.next'],
    ['наступна сторінка', 'page.next'],
    ['вперед', 'page.next'],
    ['назад', 'page.prev'],
    ['попередня сторінка', 'page.prev'],
    ['нова сторінка', 'page.new'],
    ['додай сторінку', 'page.new'],
    ['чиста сторінка', 'page.new'],
    ['нова', 'page.new'],
    ['відміни', 'undo'],
    ['скасуй', 'undo'],
    ['відмінити останнє', 'undo'],
  ])('«%s» → %s', (phrase, cmd) => {
    expect(matchRemotePhrase(phrase)).toBe(cmd)
  })

  it('пунктуація й регістр не заважають', () => {
    expect(matchRemotePhrase('Далі!')).toBe('page.next')
    expect(matchRemotePhrase('  Нова  сторінка.  ')).toBe('page.new')
  })

  it('«відміни нову сторінку» — це undo, не нова сторінка', () => {
    expect(matchRemotePhrase('відміни нову сторінку')).toBe('undo')
  })

  it('питання до Інтегралика — не команда (null)', () => {
    expect(matchRemotePhrase('побудуй графік y дорівнює x квадрат')).toBeNull()
    expect(matchRemotePhrase('дай три задачі на квадратні рівняння базовий рівень')).toBeNull()
    expect(matchRemotePhrase('що таке дискримінант')).toBeNull()
  })

  it('фраза, що містить «далі», але довша за ліміт — не команда', () => {
    const long = 'далі ми розглянемо як знайти корені квадратного рівняння через дискримінант'
    expect(long.length).toBeGreaterThan(REMOTE_GRAMMAR_MAX_LEN)
    expect(matchRemotePhrase(long)).toBeNull()
  })

  it('порожнє → null', () => {
    expect(matchRemotePhrase('')).toBeNull()
    expect(matchRemotePhrase('   ')).toBeNull()
  })

  it('слово-частина не спрацьовує як команда («далійська»)', () => {
    expect(matchRemotePhrase('далійська')).toBeNull()
  })

  // v1.2 — з уроку власника 2026-09-03
  it.each([
    ['покажи задачу', 'view.fit'],
    ['задача на екран', 'view.fit'],
    ['збільш завдання', 'view.fit'],
    ['задача', 'view.fit'],
    ['більше', 'view.zoom.in'],
    ['збільш', 'view.zoom.in'],
    ['менше', 'view.zoom.out'],
    ['зменши', 'view.zoom.out'],
    ['вгору', 'view.scroll.up'],
    ['вниз', 'view.scroll.down'],
    ['покажи відповідь', 'card.answer'],
    ['сховай відповідь', 'card.answer'],
    ['відповідь', 'card.answer'],
    ['покажи розбір', 'card.solution'],
    ['сховай розбір', 'card.solution'],
    ['покажи розв\'язання', 'card.solution'],
  ])('«%s» → %s (v1.2)', (phrase, cmd) => {
    expect(matchRemotePhrase(phrase)).toBe(cmd)
  })

  it('«відповідь» перемагає «покажи задачу»; «наступна сторінка» не стає скролом', () => {
    expect(matchRemotePhrase('покажи відповідь до задачі')).toBe('card.answer')
    expect(matchRemotePhrase('наступна сторінка')).toBe('page.next')
    expect(matchRemotePhrase('додай завдання на нерівності')).toBeNull()   // Інтегралику
  })
})
