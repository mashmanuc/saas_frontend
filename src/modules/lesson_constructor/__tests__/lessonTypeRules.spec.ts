/**
 * Правила «тип уроку → скільки тем» на клієнті.
 *
 * Ці ж правила є на бекенді й там обов'язкові. Тут вони існують заради однієї
 * речі: сказати вчителю ПРО помилку до запиту, а не показати 400 після. Тому
 * кожен тест перевіряє не лише «можна/не можна», а й що пояснення є і воно
 * людське.
 */
import { describe, it, expect } from 'vitest'
import {
  LESSON_TYPE_OPTIONS,
  ancestorsOf,
  canPickTopic,
  focusIssue,
  isBlockType,
  reconcileTopics,
  shareAnAncestor,
  topicsRequiredFor,
} from '../lessonTypeRules'

const CIRCLE = 'areas.circle'
const PARALLELOGRAM = 'areas.parallelogram'
const TRIANGLE = 'areas.triangle'
const DERIVATIVE = 'derivative'
const COMBINATORICS = 'combinatorics'

describe('словник типів', () => {
  it('рівно п’ять типів у порядку ТЗ', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.value)).toEqual(
      ['intro', 'practice', 'control', 'generalize', 'repeat'])
  })

  it('кожен тип пояснює, коли він доречний', () => {
    for (const o of LESSON_TYPE_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.hint.length).toBeGreaterThan(0)
    }
  })

  it('«custom» вчителю не пропонується — це не намір, а позначка', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.value)).not.toContain('custom')
  })
})

describe('скільки тем потрібно', () => {
  it.each(['intro', 'practice', 'control'] as const)('%s → одна', (t) => {
    expect(topicsRequiredFor(t)).toBe(1)
    expect(isBlockType(t)).toBe(false)
  })

  it.each(['generalize', 'repeat'] as const)('%s → дві', (t) => {
    expect(topicsRequiredFor(t)).toBe(2)
    expect(isBlockType(t)).toBe(true)
  })

  it('тип не обрано — потреба невідома', () => {
    expect(topicsRequiredFor('')).toBe(0)
  })
})

describe('спорідненість тем — те саме, що на сервері', () => {
  it('ланцюжок предків будується зі slug-а', () => {
    expect(ancestorsOf(CIRCLE)).toEqual(['areas', 'areas.circle'])
    expect(ancestorsOf(DERIVATIVE)).toEqual(['derivative'])
  })

  it('пара з екрана власника — споріднена', () => {
    expect(shareAnAncestor([CIRCLE, PARALLELOGRAM])).toBe(true)
  })

  it('різні розділи — не блок', () => {
    expect(shareAnAncestor([DERIVATIVE, COMBINATORICS])).toBe(false)
  })

  it('батьківська тема і її підтема — споріднені', () => {
    expect(shareAnAncestor(['areas', CIRCLE])).toBe(true)
  })
})

describe('що заважає згенерувати', () => {
  it('тип не обрано — про це й кажемо першим', () => {
    expect(focusIssue('', [])).toContain('тип уроку')
  })

  it('intro + одна тема → перешкод немає', () => {
    expect(focusIssue('intro', [TRIANGLE])).toBeNull()
  })

  it('intro + дві теми → пояснення і вихід', () => {
    const msg = focusIssue('intro', [TRIANGLE, CIRCLE])
    expect(msg).toContain('одну тему')
    expect(msg).toContain('Узагальнення')      // куди йти, а не просто «не можна»
  })

  it('generalize + дві споріднені → перешкод немає', () => {
    expect(focusIssue('generalize', [CIRCLE, PARALLELOGRAM])).toBeNull()
  })

  it('generalize + одна тема → потрібні дві', () => {
    expect(focusIssue('generalize', [CIRCLE])).toContain('двох споріднених')
  })

  it('generalize + дві неспоріднені → про розділи, не про кількість', () => {
    const msg = focusIssue('generalize', [DERIVATIVE, COMBINATORICS])
    expect(msg).toContain('різних розділів')
  })

  it('repeat поводиться як generalize', () => {
    expect(focusIssue('repeat', [CIRCLE, PARALLELOGRAM])).toBeNull()
    expect(focusIssue('repeat', [CIRCLE])).not.toBeNull()
  })
})

describe('зміна типу не залишає мовчазних наслідків', () => {
  it('з двох тем на intro — лишається одна, і сказано чому', () => {
    const r = reconcileTopics('intro', [CIRCLE, PARALLELOGRAM])
    expect(r.topics).toEqual([CIRCLE])
    expect(r.notice).toContain('одну тему')
  })

  it('з однієї теми на generalize — нічого не втрачено, мовчимо', () => {
    const r = reconcileTopics('generalize', [CIRCLE])
    expect(r.topics).toEqual([CIRCLE])
    expect(r.notice).toBeNull()
  })

  it('дві неспоріднені на generalize — лишається перша з поясненням', () => {
    const r = reconcileTopics('generalize', [DERIVATIVE, COMBINATORICS])
    expect(r.topics).toEqual([DERIVATIVE])
    expect(r.notice).toContain('різних розділів')
  })

  it('споріднена пара на generalize переживає зміну типу', () => {
    const r = reconcileTopics('generalize', [CIRCLE, PARALLELOGRAM])
    expect(r.topics).toEqual([CIRCLE, PARALLELOGRAM])
    expect(r.notice).toBeNull()
  })

  it('порожній вибір нічого не повідомляє', () => {
    expect(reconcileTopics('intro', []).notice).toBeNull()
  })
})

describe('які теми взагалі можна клікнути', () => {
  it('без типу — жодної: спершу тип', () => {
    expect(canPickTopic('', [], TRIANGLE)).toBe(false)
  })

  it('intro: друга тема недоступна', () => {
    expect(canPickTopic('intro', [], TRIANGLE)).toBe(true)
    expect(canPickTopic('intro', [TRIANGLE], CIRCLE)).toBe(false)
  })

  it('уже обрану завжди можна зняти', () => {
    expect(canPickTopic('intro', [TRIANGLE], TRIANGLE)).toBe(true)
  })

  it('generalize: другою доступна лише споріднена', () => {
    expect(canPickTopic('generalize', [CIRCLE], PARALLELOGRAM)).toBe(true)
    expect(canPickTopic('generalize', [CIRCLE], DERIVATIVE)).toBe(false)
  })

  it('generalize: третьої не буває', () => {
    expect(canPickTopic('generalize', [CIRCLE, PARALLELOGRAM], TRIANGLE)).toBe(false)
  })
})
