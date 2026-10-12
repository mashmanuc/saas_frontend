/**
 * Вікно YouTube на дошці: «Мої відео» + пошук, як у пульті.
 * ТЗ saas_docs/domains/winterboard/TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11.md §1, §5 п.1, §6;
 * LAW §9 v1.8 «Ноутбук дошки — теж».
 *
 * Перевіряємо: без `library` вікно рівно як раніше (жодного запиту); з `library` —
 * «Мої відео» лише зі свого переліку сервера, пошук тим самим REST, що пульт,
 * вибір → підтвердження → `submit` (той самий шлях, що вставка посилання).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const { searchVideos, fetchVideos } = vi.hoisted(() => ({
  searchVideos: vi.fn(),
  fetchVideos: vi.fn(),
}))

vi.mock('../../../api/winterboardApi', () => ({
  winterboardApi: { searchVideos },
}))
vi.mock('../../../api/library', () => ({
  fetchVideos,
}))

import WBYouTubeModal from '../WBYouTubeModal.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function mountModal(props: Record<string, unknown>) {
  return mount(WBYouTubeModal, {
    props: { visible: false, ...props },
    global: { plugins: [i18n], stubs: { teleport: true, transition: false } },
  })
}

async function open(w: ReturnType<typeof mountModal>) {
  await w.setProps({ visible: true })
  await flushPromises()
}

const MY_VIDEO = {
  id: 7,
  name: 'Дроби для 5 класу',
  cdn_url: 'https://www.youtube.com/watch?v=abcdefghijk',
  thumbnail_url: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
  content_type: 'youtube_link',
  status: 'active',
}

const CANDIDATE = {
  ref: { provider: 'youtube', id: 'ZZZZZZZZZZZ' },
  title: 'Теорема Піфагора',
  channel: 'Математика просто',
  thumbnail: 'https://i.ytimg.com/vi/ZZZZZZZZZZZ/mqdefault.jpg',
  duration_s: 245,
  audio_language: 'en',
  made_for_kids: false,
}

describe('WBYouTubeModal — режим «Мої відео» + пошук', () => {
  beforeEach(() => {
    searchVideos.mockReset()
    fetchVideos.mockReset()
    fetchVideos.mockResolvedValue({ count: 1, results: [MY_VIDEO] })
  })

  it('без library — вікно як раніше: ні «Моїх відео», ні пошуку, ні запитів', async () => {
    const w = mountModal({})
    await open(w)
    expect(w.find('[data-testid="yt-my-videos"]').exists()).toBe(false)
    expect(w.find('[data-testid="yt-search"]').exists()).toBe(false)
    expect(w.find('#wb-yt-url').exists()).toBe(true)
    expect(fetchVideos).not.toHaveBeenCalled()
  })

  it('«Мої відео» — угорі, з переліку сервера (лише свої активні — фільтрує BE)', async () => {
    const w = mountModal({ library: true })
    await open(w)
    expect(fetchVideos).toHaveBeenCalledTimes(1)
    expect(fetchVideos).toHaveBeenCalledWith()
    const mine = w.find('[data-testid="yt-my-videos"]')
    expect(mine.text()).toContain('Мої відео')
    expect(mine.text()).toContain('Дроби для 5 класу')
    // «Мої відео» стоять ПЕРЕД пошуком
    const html = w.html()
    expect(html.indexOf('yt-my-videos')).toBeLessThan(html.indexOf('yt-search'))
  })

  it('вибір з «Моїх відео» → підтвердження → submit з посиланням і назвою', async () => {
    const w = mountModal({ library: true })
    await open(w)
    await w.find('[data-testid="yt-my-videos"] button').trigger('click')
    expect(w.find('[data-testid="yt-pick-confirm"]').text()).toContain('Додати на поточну сторінку дошки')
    expect(w.emitted('submit')).toBeUndefined()   // до «Додати» дошка не змінюється
    await w.find('[data-testid="yt-pick-add"]').trigger('click')
    expect(w.emitted('submit')).toEqual([[{ url: MY_VIDEO.cdn_url, title: MY_VIDEO.name }]])
  })

  it('пошук — той самий REST, що в пульті; перелік з тривалістю, каналом і мовою', async () => {
    searchVideos.mockResolvedValue({ items: [CANDIDATE], dropped: {}, pool: 1, took_ms: 5 })
    const w = mountModal({ library: true })
    await open(w)
    await w.find('[data-testid="yt-search-input"]').setValue('  піфагор ')
    await w.find('[data-testid="yt-search"] form').trigger('submit')
    await flushPromises()
    expect(searchVideos).toHaveBeenCalledWith('піфагор')
    const list = w.find('[data-testid="yt-search-results"]')
    expect(list.text()).toContain('Теорема Піфагора')
    expect(list.text()).toContain('Математика просто')
    expect(list.text()).toContain('4:05')
    expect(list.text()).toContain('EN')
  })

  it('вибір з пошуку → submit з посиланням від нашого ref (адаптер youtubeParser)', async () => {
    searchVideos.mockResolvedValue({ items: [CANDIDATE], dropped: {}, pool: 1, took_ms: 5 })
    const w = mountModal({ library: true })
    await open(w)
    await w.find('[data-testid="yt-search-input"]').setValue('піфагор')
    await w.find('[data-testid="yt-search"] form').trigger('submit')
    await flushPromises()
    await w.find('[data-testid="yt-search-results"] button').trigger('click')
    await w.find('[data-testid="yt-pick-add"]').trigger('click')
    expect(w.emitted('submit')).toEqual([[{
      url: 'https://www.youtube.com/watch?v=ZZZZZZZZZZZ',
      title: 'Теорема Піфагора',
    }]])
  })

  it('«Скасувати» в підтвердженні — повертає перелік, нічого не вставляє', async () => {
    const w = mountModal({ library: true })
    await open(w)
    await w.find('[data-testid="yt-my-videos"] button').trigger('click')
    await w.find('[data-testid="yt-pick-cancel"]').trigger('click')
    expect(w.find('[data-testid="yt-pick-confirm"]').exists()).toBe(false)
    expect(w.find('[data-testid="yt-my-videos"]').exists()).toBe(true)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('квота пошуку вичерпана — пояснення і посилання лишається', async () => {
    searchVideos.mockRejectedValue({ response: { data: { error: 'video_search_quota' } } })
    const w = mountModal({ library: true })
    await open(w)
    await w.find('[data-testid="yt-search-input"]').setValue('дроби')
    await w.find('[data-testid="yt-search"] form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Пошук відео на сьогодні вичерпано')
    expect(w.find('#wb-yt-url').exists()).toBe(true)
  })

  it('пошук не налаштовано — поле пошуку ховається, посилання працює', async () => {
    searchVideos.mockRejectedValue({ response: { data: { error: 'video_search_disabled' } } })
    const w = mountModal({ library: true })
    await open(w)
    await w.find('[data-testid="yt-search-input"]').setValue('дроби')
    await w.find('[data-testid="yt-search"] form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-testid="yt-search-off"]').exists()).toBe(true)
    expect(w.find('[data-testid="yt-search-input"]').exists()).toBe(false)
    expect(w.find('#wb-yt-url').exists()).toBe(true)
  })

  it('вставка посилання в режимі library — той самий submit, що й раніше', async () => {
    const w = mountModal({ library: true })
    await open(w)
    await w.find('#wb-yt-url').setValue('https://youtu.be/abcdefghijk')
    await w.find('.wb-youtube-modal__btn--primary:not([data-testid])').trigger('click')
    expect(w.emitted('submit')).toEqual([[{ url: 'https://youtu.be/abcdefghijk', title: undefined }]])
  })

  it('«Мої відео» не завантажились — видима причина, пошук і посилання працюють', async () => {
    fetchVideos.mockRejectedValue(new Error('net'))
    const w = mountModal({ library: true })
    await open(w)
    expect(w.find('[data-testid="yt-my-videos"]').text()).toContain('Не вдалося завантажити «Мої відео»')
    expect(w.find('[data-testid="yt-search-input"]').exists()).toBe(true)
  })
})
