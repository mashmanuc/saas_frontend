/**
 * LAW §9 v1.22 · правило «який рядок — атрибуція» і джерело картинки.
 *
 * Правило одне на FE і BE (`export_attribution.split_card_attribution`): якщо тут рядок
 * ховається, а сервер його не впізнає, атрибуція зникне і з дошки, і з PDF.
 * Тому ті самі випадки перевіряє `test_export_attribution.py`.
 */
import { describe, expect, it } from 'vitest'
import { imageSource, readableUrl, splitCardAttribution } from '../board/materialAttribution'

const URL = 'https://uk.wikipedia.org/wiki/Мазепа'
const REF = { url: URL }
const TASL = `Джерело: «Іван Мазепа», Вікіпедія (uk), Автори Вікіпедії · ${URL} · CC BY-SA 4.0`

describe('splitCardAttribution', () => {
  it('останній абзац — TASL про джерело картки: текст окремо, атрибуція й адреса окремо', () => {
    expect(splitCardAttribution(`Гетьман.\n\nДругий абзац.\n\n${TASL}`, [REF]))
      .toEqual({ text: 'Гетьман.\n\nДругий абзац.', attribution: TASL, url: URL })
  })

  it('англійська картка — «Source: »', () => {
    const en = 'https://en.wikipedia.org/wiki/Mazepa'
    const line = `Source: “Ivan Mazepa”, Wikipedia (en), Wikipedia contributors · ${en} · CC BY-SA 4.0`
    expect(splitCardAttribution(`Hetman.\n\n${line}`, [{ url: en }])).toEqual({ text: 'Hetman.', attribution: line, url: en })
  })

  it('пробіли й перенос у кінці не заважають', () => {
    expect(splitCardAttribution(`Гетьман.\n\n${TASL}\n  `, [REF])).toEqual({ text: 'Гетьман.', attribution: TASL, url: URL })
  })

  it('картка поза гейтом коридорів (без sources[]): «Джерело: Вікіпедія — адреса»', () => {
    const url = 'https://uk.wikipedia.org/wiki/%D0%9C%D0%B0%D0%B7%D0%B5%D0%BF%D0%B0'
    const line = `Джерело: Вікіпедія — ${url}`
    expect(splitCardAttribution(`Гетьман.\n\n${line}`, undefined)).toEqual({ text: 'Гетьман.', attribution: line, url })
  })

  it.each([
    ['TASL без sources[]', `Гетьман.\n\n${TASL}`, undefined],
    ['TASL з порожнім sources[]', `Гетьман.\n\n${TASL}`, []],
    ['лише один абзац', TASL, [REF]],
    ['інший підпис', `Гетьман.\n\nДжерела: ${URL}`, [REF]],
    ['адреса іншого джерела', `Гетьман.\n\n${TASL}`, [{ url: 'https://uk.wikipedia.org/wiki/Інше' }]],
    ['джерело з небезпечною адресою', 'Гетьман.\n\nДжерело: javascript:alert(1)', [{ url: 'javascript:alert(1)' }]],
    ['абзац на кілька рядків', `Гетьман.\n\n${TASL}\nще рядок`, [REF]],
    ['старий рядок, але з sources[] (не про джерело)', 'Гетьман.\n\nДжерело: Вікіпедія — https://x.org/a', [REF]],
    ['старий рядок із хвостом після адреси', 'Гетьман.\n\nДжерело: Вікіпедія — https://x.org/a і ще', undefined],
    ['старий рядок без веб-адреси', 'Гетьман.\n\nДжерело: Вікіпедія — javascript:alert(1)', undefined],
  ])('%s — текст як є, нічого не ховаємо', (_label, body, sources) => {
    expect(splitCardAttribution(body, sources)).toEqual({ text: body, attribution: '', url: '' })
  })

  it('не рядок — порожній текст, без падіння', () => {
    expect(splitCardAttribution(undefined, [REF])).toEqual({ text: '', attribution: '', url: '' })
  })

  it('readableUrl: кирилиця для очей; зіпсоване кодування — як є', () => {
    expect(readableUrl('https://uk.wikipedia.org/wiki/%D0%9C%D0%B0%D0%B7%D0%B5%D0%BF%D0%B0')).toBe('https://uk.wikipedia.org/wiki/Мазепа')
    expect(readableUrl('https://x.org/%E0%A4%A')).toBe('https://x.org/%E0%A4%A')
  })
})

describe('imageSource', () => {
  const image = (data: Record<string, unknown> | undefined) => ({ type: 'image', data } as never)

  it('картинка Інтегралика: назва файла з провенансу, автор, ліцензія, провайдер мовою матеріалу', () => {
    expect(imageSource(image({
      caption: 'Ivan Mazepa', source: 'wikimedia_commons', source_url: 'https://commons.wikimedia.org/wiki/File:M.jpg',
      author: 'Osipov', license: 'CC BY-SA 4.0', content_language: 'en',
      provenance: { source_title: 'File:M.jpg', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    }))).toEqual({
      language: 'en', title: 'File:M.jpg', url: 'https://commons.wikimedia.org/wiki/File:M.jpg',
      author: 'Osipov', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      provider: 'Wikimedia Commons',
    })
  })

  it('стара картинка без коридору: назва статті, українські підписи', () => {
    const src = imageSource(image({ caption: 'Ісаак Ньютон', source: 'wikimedia_commons', source_url: 'https://commons.wikimedia.org/wiki/File:N.jpg', license: 'Public domain' }))
    expect(src).toMatchObject({ language: 'uk', title: 'Ісаак Ньютон', provider: 'Вікісховище', author: '', licenseUrl: '' })
  })

  it.each([
    ['власна картинка вчителя', { type: 'image', data: undefined }],
    ['без адреси джерела', { type: 'image', data: { caption: 'x' } }],
    ['небезпечна адреса', { type: 'image', data: { source_url: 'javascript:alert(1)' } }],
    ['не картинка', { type: 'theory_card', data: { source_url: 'https://x.org' } }],
  ])('%s — значка немає', (_label, asset) => {
    expect(imageSource(asset as never)).toBeNull()
  })

  it('небезпечна адреса ліцензії не стає посиланням', () => {
    expect(imageSource(image({ source_url: 'https://c.org/f', provenance: { license_url: 'javascript:x' } }))?.licenseUrl).toBe('')
  })
})
