/**
 * Власник 2026-10-19: «як має пересічний викладач знати… мінімалізм і простота» → «перевір інші значки,
 * чи всі мають підписи». Значок без слова на дошці — нормально; значок, який нічого не каже навіть під
 * курсором (а на телефоні — без слова під собою), — ні. Запобіжник для місць, виправлених 19.10.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import uk from '../../../i18n/locales/uk.json'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const buttons = (source: string) => source.match(/<button\b[^>]*>/gs) ?? []

describe('значки мають назву', () => {
  it('група дій картки: кожна кнопка — зі спливною назвою (✍ 💡 ⚠ теж)', () => {
    const all = buttons(read('modules/winterboard/components/canvas/WBCardWindowControls.vue'))
    expect(all.length).toBeGreaterThanOrEqual(9)
    for (const b of all) expect(b).toMatch(/\s:?title=/)
  })

  it('ліва панель: назви ховаються лише там, де немає наведення, а не за шириною вікна', () => {
    const css = read('modules/winterboard/components/toolbar/WBToolbar.vue')
    expect(css).toMatch(/@media \(hover: none\) \{\n {2}\.wb-toolbar__btn--tooltip::after \{\n {4}display: none;/)
    expect(css).not.toMatch(/@media \(max-width: 1024px\) \{\n {2}\.wb-toolbar__btn--tooltip::after/)
  })

  it('картка історії, бічна панель, матеріали, сторінки, аудіо, B / I — зі спливною назвою', () => {
    const checks: Array<[string, RegExp]> = [
      ['modules/winterboard/components/board/objects/HistoryCardRenderer.vue', /class="history-card__hint"\n\s+:title=/],
      ['modules/winterboard/components/board/objects/HistoryCardRenderer.vue', /class="history-card__pin"\n\s+:title=/],
      ['modules/winterboard/views/WBSoloRoom.vue', /class="wb-solo-room__sidebar-toggle"\n\s+type="button"\n\s+:title=/],
      ['modules/winterboard/views/WBConstructorRoom.vue', /class="wb-solo-room__sidebar-toggle"\n\s+type="button"\n\s+:title=/],
      ['modules/winterboard/components/sidebar/ContentSidebar.vue', /class="content-sidebar__yt-submit"\n\s+:title=/],
      ['modules/winterboard/components/sidebar/ContentSidebar.vue', /class="content-sidebar__retry" :title=/],
      ['modules/winterboard/components/sidebar/GroupContentSidebar.vue', /class="tools-crumb__back" :title=/],
      ['modules/winterboard/components/pages/WBPageThumbnails.vue', /class="wb-thumbnail__action wb-thumbnail__delete"\n\s+:title=/],
      ['modules/winterboard/components/sidebar/AudioAnnotationPanel.vue', /audio-annotation-panel__btn--play"\n\s+:title=/],
      ['modules/winterboard/components/canvas/WBSelectionToolbar.vue', /:title="t\('winterboard\.selection\.bold'\)"/],
      ['modules/winterboard/components/canvas/WBSelectionToolbar.vue', /:title="t\('winterboard\.selection\.italic'\)"/],
    ]
    for (const [file, re] of checks) expect(read(file), file).toMatch(re)
  })

  it('пульт на телефоні: під ⚙ і 👁 — слово (на дотику спливних назв немає)', () => {
    expect(read('modules/winterboard/views/WBRemoteView.vue'))
      .toMatch(/<span aria-hidden="true">⚙<\/span><span class="wb-remote__icon-label"/)
    expect(read('modules/winterboard/components/remote/RemoteBoardMirror.vue'))
      .toMatch(/<span aria-hidden="true">👁<\/span><span class="wb-mirror__icon-label"/)
  })

  it('підписи українською: «Фон», «Жирний», «Курсив», «Перегляд»', () => {
    const wb = (uk as any).winterboard
    expect(wb.room.bgColorShort).toBe('Фон')
    expect([wb.selection.bold, wb.selection.italic]).toEqual(['Жирний', 'Курсив'])
    expect(wb.remote.mirror.previewShort).toBe('Перегляд')
  })
})
