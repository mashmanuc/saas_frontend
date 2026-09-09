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
  focusIssueOf,
  isAncestorPair,
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

/**
 * Тест 8 ТЗ у переробленому вигляді (рішення власника 2026-09-09):
 * перевіряємо СТАБІЛЬНИЙ КОД помилки і наявність людського пояснення тут, на
 * фронті. Динамічної «рекомендованої пари» немає свідомо — підказка, зібрана
 * з даних на льоту, обіцяла б учителю конкретні теми, яких у його розділі
 * може й не бути.
 */
describe('пара «розділ + його підтема» — код і пояснення', () => {
  const BLOCK_TYPES = ['generalize', 'repeat'] as const

  it.each(BLOCK_TYPES)('%s: предок+нащадок дає focus_ancestor_pair', (type) => {
    const issue = focusIssueOf(type, ['areas', 'areas.circle'])

    expect(issue?.code).toBe('focus_ancestor_pair')
  })

  it.each(BLOCK_TYPES)('%s: дві різні підтеми проходять', (type) => {
    expect(focusIssueOf(type, ['areas.circle', 'areas.triangle'])).toBeNull()
  })

  it('глибокий предок ловиться так само', () => {
    const issue = focusIssueOf('generalize',
      ['real-numbers', 'real-numbers.fractions.ordinary'])

    expect(issue?.code).toBe('focus_ancestor_pair')
  })

  it('порядок тем не змінює вердикту', () => {
    expect(focusIssueOf('generalize', ['areas.circle', 'areas'])?.code)
      .toBe('focus_ancestor_pair')
  })

  it('кожен код має людське пояснення, а не сам себе', () => {
    const cases: Array<[string, string[]]> = [
      ['generalize', []],
      ['generalize', ['areas.circle']],
      ['generalize', ['areas', 'areas.circle']],
      ['generalize', ['derivative', 'areas.circle']],
      ['intro', ['areas', 'areas.circle']],
      ['', ['areas.circle']],
    ]
    for (const [type, topics] of cases) {
      const issue = focusIssueOf(type as any, topics)
      expect(issue).not.toBeNull()
      expect(issue!.message.length).toBeGreaterThan(20)
      // Пояснення для людини, а не код у полі тексту.
      expect(issue!.message).not.toContain('focus_')
    }
  })

  it('однотемний урок дістає СВОЮ помилку, не про узагальнення', () => {
    expect(focusIssueOf('intro', ['areas', 'areas.circle'])?.code)
      .toBe('focus_single_topic')
  })

  it('другою темою не можна клікнути власну підтему', () => {
    expect(canPickTopic('generalize', ['areas'], 'areas.circle')).toBe(false)
    expect(canPickTopic('generalize', ['areas.circle'], 'areas.triangle')).toBe(true)
  })

  it('зміна типу прибирає фальшиву пару й каже, чому', () => {
    const out = reconcileTopics('generalize', ['areas', 'areas.circle'])

    expect(out.topics).toEqual(['areas'])
    expect(out.notice).toContain('частиною іншої')
  })
})
