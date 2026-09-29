/**
 * LAW §9 v1.22 · кнопка «Джерело» в куті картинки Інтегралика (власник 2026-09-29).
 *
 * Стереже: (1) на дошці лише маленька кнопка — повна атрибуція схована; (2) натиск дає
 * назву-посилання, провайдера, автора, ліцензію; (3) підписи мовою МАТЕРІАЛУ; (4) натиск
 * не доходить до полотна (не виділяє картинку); (5) закривається повз картку і Esc.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SourceBadge from '../components/canvas/SourceBadge.vue'
import type { ImageSource } from '../board/materialAttribution'

const SOURCE: ImageSource = {
  language: 'uk',
  title: 'File:Mazepa.jpg',
  url: 'https://commons.wikimedia.org/wiki/File:Mazepa.jpg',
  author: 'Осипов',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  provider: 'Вікісховище',
}

let wrapper: VueWrapper | null = null
const mountBadge = (source: Partial<ImageSource> = {}) => {
  wrapper = mount(SourceBadge, { props: { source: { ...SOURCE, ...source } }, attachTo: document.body })
  return wrapper
}
afterEach(() => { wrapper?.unmount(); wrapper = null })

describe('SourceBadge', () => {
  it('на дошці — лише кнопка «Джерело», атрибуція схована', () => {
    const w = mountBadge()
    expect(w.find('[data-testid="source-badge"]').text()).toBe('Джерело')
    expect(w.find('[data-testid="source-badge-card"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Осипов')
  })

  it('натиск — назва-посилання, провайдер, автор, ліцензія-посилання', async () => {
    const w = mountBadge()
    await w.find('[data-testid="source-badge"]').trigger('click')
    const card = w.find('[data-testid="source-badge-card"]')
    const title = card.find('.wb-source-badge__title')
    expect(title.attributes('href')).toBe(SOURCE.url)
    expect(title.attributes('target')).toBe('_blank')
    expect(title.attributes('rel')).toContain('noopener')
    expect(title.text()).toBe('File:Mazepa.jpg')
    expect(card.text()).toContain('Вікісховище')
    expect(card.text()).toContain('Автор: Осипов')
    expect(card.text()).toContain('Ліцензія: CC BY-SA 4.0')
    expect(card.find(`a[href="${SOURCE.licenseUrl}"]`).exists()).toBe(true)
    expect(w.find('[data-testid="source-badge"]').attributes('aria-expanded')).toBe('true')
  })

  it('англійська картинка — англійські підписи, хоч UI український', async () => {
    const w = mountBadge({ language: 'en', provider: 'Wikimedia Commons' })
    expect(w.find('[data-testid="source-badge"]').text()).toBe('Source')
    await w.find('[data-testid="source-badge"]').trigger('click')
    const text = w.find('[data-testid="source-badge-card"]').text()
    expect(text).toContain('Author: Осипов')
    expect(text).toContain('License: CC BY-SA 4.0')
    expect(text).not.toContain('Автор')
  })

  it('без назви — хост адреси; без адреси ліцензії — ліцензія текстом (не ховаємо)', async () => {
    const w = mountBadge({ title: '', licenseUrl: '' })
    await w.find('[data-testid="source-badge"]').trigger('click')
    const card = w.find('[data-testid="source-badge-card"]')
    expect(card.find('.wb-source-badge__title').text()).toBe('commons.wikimedia.org')
    expect(card.findAll('a')).toHaveLength(1)
    expect(card.text()).toContain('Ліцензія: CC BY-SA 4.0')
  })

  it('натиск не доходить до полотна — картинка не виділяється', async () => {
    const w = mountBadge()
    const seen: string[] = []
    const parent = w.element.parentElement!
    for (const type of ['pointerdown', 'mousedown', 'click']) parent.addEventListener(type, () => seen.push(type))
    const pill = w.find('[data-testid="source-badge"]')
    await pill.trigger('pointerdown')
    await pill.trigger('mousedown')
    await pill.trigger('click')
    expect(seen).toEqual([])
  })

  it('закривається натиском повз картку і клавішею Esc; натиск по картці — лишає відкритою', async () => {
    const w = mountBadge()
    const pill = w.find('[data-testid="source-badge"]')
    await pill.trigger('click')
    await w.find('[data-testid="source-badge-card"]').trigger('pointerdown')
    expect(w.find('[data-testid="source-badge-card"]').exists()).toBe(true)

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-testid="source-badge-card"]').exists()).toBe(false)

    await pill.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-testid="source-badge-card"]').exists()).toBe(false)
  })

  it('повторний натиск на кнопку — згортає', async () => {
    const w = mountBadge()
    const pill = w.find('[data-testid="source-badge"]')
    await pill.trigger('click')
    await pill.trigger('click')
    expect(w.find('[data-testid="source-badge-card"]').exists()).toBe(false)
  })
})

// Полотно в тестах не монтується (Konva) — стережемо проводку за джерелом, як
// `evidenceToolsGate.spec`. Живий вигляд перевіряється на стенді.
describe('WBCanvas · проводка кнопки «Джерело»', () => {
  const canvasSource = () => import('node:fs').then((fs) =>
    fs.readFileSync('src/modules/winterboard/components/canvas/WBCanvas.vue', 'utf8'))

  it('кнопка — для тих самих assets, що йдуть на полотно, і лише там, де imageSource() її дає', async () => {
    const src = await canvasSource()
    expect(src).toMatch(/for \(const a of assets\.value\) \{\s*const source = imageSource\(a\)/)
    expect(src).toMatch(/v-for="item in itemsWithSource"[\s\S]{0,200}<SourceBadge :source="item\.source" \/>/)
  })

  it('правий НИЖНІЙ кут усередині картинки (верхній правий — audio|text|link)', async () => {
    const src = await canvasSource()
    const fn = src.slice(src.indexOf('function sourceBadgePosition'), src.indexOf('// Overlay state'))
    expect(fn).toContain('(asset.x + asset.w) * zoom + offset.x')
    expect(fn).toContain('(asset.y + asset.h) * zoom + offset.y')
    expect(fn).toContain("transform: 'translate(-100%, -100%)'")
    expect(fn).toContain("pointerEvents: 'none'")
  })
})
