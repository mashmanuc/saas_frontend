/**
 * «+» на плитках «Інструментів» (власник 2026-10-21: «немає + який додає картку на дошку — для сенсорних дошок
 * це херово»). Плитка без «+» на сенсорній дошці — лише тап, який легко зривається в перетягування.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import InsertTileWithAdd from '../InsertTileWithAdd.vue'
import { ADD_TOOL_TO_BOARD_KEY } from '../../../composables/useAddToolToBoard'
import { allInserts } from '../insertRegistry'

const SIDEBAR = readFileSync('src/modules/winterboard/components/sidebar/GroupContentSidebar.vue', 'utf8')
const TILE = readFileSync('src/modules/winterboard/components/sidebar/InsertTileWithAdd.vue', 'utf8')

describe('«+» на плитках «Інструментів»', () => {
  it('у бічній панелі кожен список плиток — плитка з «+» (жодної голої InsertResultTile)', () => {
    expect(SIDEBAR).not.toContain('<InsertResultTile')
    for (const list of ['toolResults', 'inequalityEntries', 'geomashEntries', 'threeDEntries', 'contentEntries', 'sceneEntries']) {
      expect(SIDEBAR, list).toContain(`<InsertTileWithAdd v-for="e in ${list}"`)
    }
  })

  it('на дотик «+» видно завжди і він великий; мишею — при наведенні', () => {
    expect(TILE).toMatch(/@media \(any-pointer: coarse\) \{\s*\.tile-add__btn \{ opacity: 1; pointer-events: auto; width: 30px; height: 30px;/)
    expect(TILE).toMatch(/\.tile-add:hover \.tile-add__btn/)
  })

  it('натиск «+» вставляє саме цей інструмент — тим самим шляхом, що клік по плитці', async () => {
    const add = vi.fn()
    const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })
    const entry = allInserts().find((e) => e.id === 'scenes.galton')!
    const w = mount(InsertTileWithAdd, { props: { entry }, global: { plugins: [i18n], provide: { [ADD_TOOL_TO_BOARD_KEY as symbol]: add } } })
    const btn = w.get(`[data-testid="insert-add-${entry.id}"]`)
    expect(entry.payload).toBe('{"sceneId":"galton"}')
    expect(btn.attributes('title')).toContain('Дошка Гальтона')
    await btn.trigger('click')
    expect(add).toHaveBeenCalledOnce()
    expect(add).toHaveBeenCalledWith(entry.dragMime, entry.payload)
  })
})
