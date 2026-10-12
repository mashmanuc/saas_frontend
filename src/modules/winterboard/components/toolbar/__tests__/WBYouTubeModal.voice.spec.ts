/**
 * Вікно YouTube на дошці: мікрофон у пошуку (власник 2026-10-12: «в те відео пошук. Додати мікрофона.
 * Щоб можна було голосом шукати» — без Інтегралика, розпізнавання в браузері).
 *
 * Перший дотик — слухає й пише в поле пошуку; другий — зупиняє й шукає сказане тим самим REST, що
 * кнопка «Знайти». Браузер без Web Speech — кнопки немає.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const { searchVideos, fetchVideos, voice } = vi.hoisted(() => ({
  searchVideos: vi.fn(),
  fetchVideos: vi.fn(),
  voice: { supported: true, listening: null as unknown as Ref<boolean>, model: null as Ref<string> | null,
    toggle: null as unknown as (m: Ref<string>) => void, stop: null as unknown as () => void },
}))

vi.mock('../../../api/winterboardApi', () => ({ winterboardApi: { searchVideos } }))
vi.mock('../../../api/library', () => ({ fetchVideos }))
vi.mock('@/composables/useVoiceDictation', () => ({
  useVoiceDictation: () => ({
    supported: voice.supported,
    listening: voice.listening,
    toggle: (m: Ref<string>) => voice.toggle(m),
    stop: () => voice.stop(),
    start: vi.fn(),
    reset: vi.fn(),
  }),
}))

import WBYouTubeModal from '../WBYouTubeModal.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

async function openModal() {
  const w = mount(WBYouTubeModal, {
    props: { visible: false, library: true },
    global: { plugins: [i18n], stubs: { teleport: true, transition: false } },
  })
  await w.setProps({ visible: true })
  await flushPromises()
  return w
}

describe('WBYouTubeModal — голосовий пошук', () => {
  beforeEach(() => {
    searchVideos.mockReset()
    searchVideos.mockResolvedValue({ items: [], dropped: {}, pool: 0, took_ms: 1 })
    fetchVideos.mockReset()
    fetchVideos.mockResolvedValue({ count: 0, results: [] })
    voice.supported = true
    voice.listening = ref(false)
    voice.model = null
    voice.stop = vi.fn(() => { voice.listening.value = false })
    voice.toggle = vi.fn((m: Ref<string>) => {
      if (voice.listening.value) { voice.stop() } else { voice.model = m; voice.listening.value = true }
    })
  })

  it('браузер без Web Speech — мікрофона немає, пошук текстом як був', async () => {
    voice.supported = false
    const w = await openModal()
    expect(w.find('[data-testid="yt-search-mic"]').exists()).toBe(false)
    expect(w.find('[data-testid="yt-search-input"]').exists()).toBe(true)
  })

  it('перший дотик — слухає в поле пошуку й каже «Слухаю…»', async () => {
    const w = await openModal()
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    expect(voice.toggle).toHaveBeenCalledTimes(1)
    expect(voice.listening.value).toBe(true)
    const input = w.find('[data-testid="yt-search-input"]')
    expect(input.attributes('placeholder')).toBe(uk.winterboard.youtube.picker.listening)
    expect(w.find('[data-testid="yt-search-mic"]').attributes('aria-pressed')).toBe('true')
    expect(searchVideos).not.toHaveBeenCalled()
  })

  it('другий дотик — зупиняє й шукає сказане (один запит)', async () => {
    const w = await openModal()
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    voice.model!.value = 'мамонт'                 // рушій дописав розпізнане в поле
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    await flushPromises()
    expect(voice.listening.value).toBe(false)
    expect(searchVideos).toHaveBeenCalledTimes(1)
    expect(searchVideos).toHaveBeenCalledWith('мамонт')
  })

  it('нічого не сказали — зупинка без пошуку', async () => {
    const w = await openModal()
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    await flushPromises()
    expect(searchVideos).not.toHaveBeenCalled()
  })

  it('«Знайти» під час диктовки — спершу зупиняє мікрофон', async () => {
    const w = await openModal()
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    voice.model!.value = 'мамонт'
    await w.find('form.wb-youtube-modal__search').trigger('submit')
    await flushPromises()
    expect(voice.stop).toHaveBeenCalled()
    expect(searchVideos).toHaveBeenCalledWith('мамонт')
  })

  it('вікно закрили під час диктовки — мікрофон вимикається', async () => {
    const w = await openModal()
    await w.find('[data-testid="yt-search-mic"]').trigger('click')
    await w.setProps({ visible: false })
    await flushPromises()
    expect(voice.stop).toHaveBeenCalled()
    expect(voice.listening.value).toBe(false)
  })
})
