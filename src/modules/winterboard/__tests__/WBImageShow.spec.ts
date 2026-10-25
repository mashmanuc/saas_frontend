/**
 * Вікно показу картинки (LAW §9 v1.60): картинка поверх усього, ціла; нова картинка приходить плавно (ключ — id, стара
 * й нова лежать одна на одній, поки триває перехід); × — закрити.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import WBImageShow from '../components/canvas/WBImageShow.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
const mountShow = (asset: { id: string; src?: unknown } | null) =>
  mount(WBImageShow, { props: { asset }, global: { plugins: [i18n], stubs: { teleport: true } } })

describe('WBImageShow', () => {
  it('без картинки — нічого; з картинкою — ціла картинка поверх усього', () => {
    expect(mountShow(null).find('[data-testid=image-show]').exists()).toBe(false)
    const w = mountShow({ id: 'slide-03', src: '/media/slide03.png' })
    expect(w.find('[data-testid=image-show-slide-03]').attributes('src')).toBe('/media/slide03.png')
  })

  it('інша картинка — новий елемент (плавна заміна за ключем); × — подія закриття', async () => {
    const w = mountShow({ id: 'a', src: '/a.png' })
    await w.setProps({ asset: { id: 'b', src: '/b.png' } })
    expect(w.find('[data-testid=image-show-b]').attributes('src')).toBe('/b.png')
    await w.find('[data-testid=image-show-close]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
