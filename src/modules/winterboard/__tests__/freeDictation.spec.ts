// LAW §9 v1.69 «Вільний диктант»: сказане → рядки поля (розмітка голосом), поле → шматки для `board.dictate` по одному.
import { describe, it, expect } from 'vitest'
import {
  CENTER_MARK, addNewLine, addSkippedLine, applySpokenLayout, chunksToField, fieldToChunks, lastLineCentered, mergeSpoken, parseSpoken,
  textForPunctuation, toggleCenterLast, withPunctuated,
} from '../remote/freeDictation'
import { DICTATE_TEXT_MAX_LEN } from '../remote/dictationContract'

const say = (field: string, spoken: string, lang: 'uk' | 'en' = 'uk') => mergeSpoken(field, parseSpoken(spoken, lang), lang)

describe('вільний диктант · розмітка голосом', () => {
  it('приклад власника: дата й «Класна робота» посередині, пропуск, диктант з нового рядка', () => {
    const field = say('', 'посередині двадцять восьме жовтня з нового рядка посередині класна робота пропусти рядок'
      + ' диктант крапка з нового рядка осінь прийшла тихо')
    expect(field).toBe(`${CENTER_MARK} Двадцять восьме жовтня\n${CENTER_MARK} Класна робота\n\nДиктант.\nОсінь прийшла тихо`)
    expect(fieldToChunks(field)).toEqual([
      { text: 'Двадцять восьме жовтня\nКласна робота', align: 'center', skip: 0 },
      { text: 'Диктант.\nОсінь прийшла тихо', align: 'left', skip: 1 },
    ])
  })

  it('«посередині» посеред речення — звичайне слово; розділові слова — знаки', () => {
    expect(say('', 'ми стояли посередині поля кома а сонце сідало')).toBe('Ми стояли посередині поля, а сонце сідало')
  })

  it('продовження: без команди сказане дописується до останнього рядка (з малої після коми)', () => {
    expect(say('Сонце сходило,', 'птахи співали крапка')).toBe('Сонце сходило, птахи співали.')
    expect(say(`${CENTER_MARK} Класна`, 'робота')).toBe(`${CENTER_MARK} Класна робота`)
  })

  it('«з нового рядка» на початку не пропускає рядок; «пропусти рядок» — рівно один порожній', () => {
    expect(say('Перше речення.', 'з нового рядка друге')).toBe('Перше речення.\nДруге')
    expect(say('Перше речення.', 'пропусти рядок друге')).toBe('Перше речення.\n\nДруге')
    expect(fieldToChunks('Перше речення.\n\nДруге')).toEqual([
      { text: 'Перше речення.', align: 'left', skip: 0 },
      { text: 'Друге', align: 'left', skip: 1 },
    ])
  })

  it('англійською — свої команди', () => {
    expect(say('', 'centre the cat new line it sat on the mat full stop', 'en'))
      .toBe(`${CENTER_MARK} The cat\nIt sat on the mat.`)
  })
})

describe('вільний диктант · кнопки під полем', () => {
  it('«Посередині» на порожньому полі — наступне сказане посередині; на рядку — ставить і знімає', () => {
    const f = toggleCenterLast('')
    expect(lastLineCentered(f)).toBe(true)
    expect(say(f, 'класна робота')).toBe(`${CENTER_MARK} Класна робота`)
    expect(toggleCenterLast(`${CENTER_MARK} Класна робота`)).toBe('Класна робота')
    expect(toggleCenterLast('Класна робота')).toBe(`${CENTER_MARK} Класна робота`)
  })

  it('«Новий рядок» і «Пропустити рядок» — наступне сказане стає в новий рядок', () => {
    expect(say(addNewLine('Перше.'), 'друге')).toBe('Перше.\nДруге')
    expect(addNewLine('Перше.\n')).toBe('Перше.\n')                  // уже порожній рядок — не множимо
    expect(say(addSkippedLine('Перше.'), 'друге')).toBe('Перше.\n\nДруге')
    expect(say(addSkippedLine(addNewLine('Перше.')), 'друге')).toBe('Перше.\n\nДруге')
  })
})

describe('вільний диктант · шматки для дошки', () => {
  it('кожен шматок ≤ 300 знаків: довгий абзац — за кінцем речення', () => {
    const sentence = 'Осінь прийшла тихо й непомітно до старого саду над рікою. '
    const long = sentence.repeat(12).trim()
    const chunks = fieldToChunks(long)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(DICTATE_TEXT_MAX_LEN)
      expect(c.text.endsWith('.')).toBe(true)
    }
    expect(chunks.map((c) => c.text).join(' ').replace(/\n/g, ' ')).toBe(long)
  })

  it('ноутбук без «посередині» — усе ліворуч; написаний шматок зникає з поля', () => {
    const field = `${CENTER_MARK} 28 жовтня\n\nДиктант.`
    expect(fieldToChunks(field, false).map((c) => c.align)).toEqual(['left', 'left'])
    const chunks = fieldToChunks(field)
    expect(chunksToField(chunks)).toBe(field)
    expect(chunksToField(chunks.slice(1))).toBe('\nДиктант.')
    expect(fieldToChunks(chunksToField(chunks.slice(1)))).toEqual([{ text: 'Диктант.', align: 'left', skip: 1 }])
  })

  it('порожнє чи лише «↔» — нічого не шлемо', () => {
    expect(fieldToChunks('')).toEqual([])
    expect(fieldToChunks(`${CENTER_MARK} \n\n`)).toEqual([])
  })
})

describe('вільний диктант · знаки після зупинки', () => {
  it('на «Розставити знаки» — лише непорожні рядки без «↔»; відповідь лягає назад на свої місця', () => {
    const parsed = parseSpoken('посередині класна робота пропусти рядок осінь прийшла тихо а сад мовчав')
    expect(textForPunctuation(parsed)).toBe('Класна робота\nОсінь прийшла тихо а сад мовчав')
    const fixed = withPunctuated(parsed, 'Класна робота.\nОсінь прийшла тихо, а сад мовчав.')
    expect(mergeSpoken('', fixed)).toBe(`${CENTER_MARK} Класна робота.\n\nОсінь прийшла тихо, а сад мовчав.`)
  })
})

describe('v1.76 · текст із мікрофона клавіатури', () => {
  it('слова розмітки в тексті з клавіатури стають розміткою (знімок власника 29.10)', () => {
    const typed = 'Світає край неба палає, соловейко в темі гаї. Дуже офігенно записує з нового рядка посередині бувай здорова.'
    expect(applySpokenLayout(typed)).toBe(
      `Світає край неба палає, соловейко в темі гаї. Дуже офігенно записує\n${CENTER_MARK} Бувай здорова.`)
  })

  it('«пропусти рядок» — порожній рядок; «з нового рядка» в кінці рядка поля не робить зайвого пропуску', () => {
    expect(applySpokenLayout('Перше речення пропусти рядок друге речення')).toBe('Перше речення\n\nДруге речення')
    expect(applySpokenLayout('Перше з нового рядка\nДруге')).toBe('Перше\nДруге')
  })

  it('рядки без команд і розмітка поля — без змін; «посередині» посеред речення — звичайне слово', () => {
    const field = `${CENTER_MARK} 30 жовтня\n\nОсінь прийшла тихо, а сад мовчав`
    expect(applySpokenLayout(field)).toBe(field)
    expect(applySpokenLayout('стояли посередині поля')).toBe('стояли посередині поля')
  })
})
