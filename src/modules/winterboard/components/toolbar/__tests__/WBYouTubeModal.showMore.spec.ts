/**
 * Вікно YouTube на дошці: «Показати ще 5» під результатами пошуку
 * (рішення власника 2026-10-12, «роби»).
 *
 * Сервер віддає до 20 відео за ОДИН пошук. Вікно спершу показує 5; «Показати ще 5»
 * розкриває наступні 5 з УЖЕ отриманих — без нового запиту й без витрати квоти.
 * Показано все — кнопки немає, натомість підказка «Спробуйте інші слова».
 * Новий пошук скидає показ до 5.
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

const P = (uk as any).winterboard.youtube.picker
const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function cand(n: number, prefix = 'v') {
  const id = `${prefix}${String(n).padStart(10, '0')}`   // 11 символів, як справжній id
  return {
    ref: { provider: 'youtube', id },
    title: `Відео ${prefix}${n}`,
    channel: 'Канал',
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    duration_s: 60,
    audio_language: 'uk',
    made_for_kids: false,
  }
}
const found = (n: number, prefix = 'v') => ({
  items: Array.from({ length: n }, (_, i) => cand(i + 1, prefix)),
  dropped: { ru: 0, not_playable: 0 },
  pool: 50,
  took_ms: 5,
})

async function openAndSearch(query = 'дроби') {
  const w = mount(WBYouTubeModal, {
    props: { visible: false, library: true },
    global: { plugins: [i18n], stubs: { teleport: true, transition: false } },
  })
  await w.setProps({ visible: true })
  await flushPromises()
  await search(w, query)
  return w
}

async function search(w: ReturnType<typeof mount>, query: string) {
  await w.find('[data-testid="yt-search-input"]').setValue(query)
  await w.find('[data-testid="yt-search"] form').trigger('submit')
  await flushPromises()
}

const titles = (w: ReturnType<typeof mount>) =>
  w.findAll('[data-testid="yt-search-results"] li').map((li) => li.text())
const more = (w: ReturnType<typeof mount>) => w.find('[data-testid="yt-search-more"]')
const allShown = (w: ReturnType<typeof mount>) => w.find('[data-testid="yt-search-all-shown"]')

describe('WBYouTubeModal — «Показати ще 5» з уже отриманих', () => {
  beforeEach(() => {
    searchVideos.mockReset()
    fetchVideos.mockReset()
    fetchVideos.mockResolvedValue({ count: 0, results: [] })
  })

  it('20 від сервера: 5 → 10 → 15 → 20, далі кнопки немає й є підказка; запит до сервера один', async () => {
    searchVideos.mockResolvedValue(found(20))
    const w = await openAndSearch()

    expect(titles(w)).toHaveLength(5)
    expect(titles(w)[0]).toContain('Відео v1')
    expect(titles(w)[4]).toContain('Відео v5')
    expect(more(w).text()).toBe('Показати ще 5')
    expect(allShown(w).exists()).toBe(false)

    for (const expected of [10, 15, 20]) {
      await more(w).trigger('click')
      expect(titles(w)).toHaveLength(expected)
      expect(titles(w)[expected - 1]).toContain(`Відео v${expected}`)   // порядок сервера збережено
    }

    expect(more(w).exists()).toBe(false)
    expect(allShown(w).text()).toBe(P.tryOtherWords)
    expect(P.tryOtherWords).toBe('Спробуйте інші слова')
    expect(searchVideos).toHaveBeenCalledTimes(1)                       // «ще» не витрачає квоту
  })

  it('останній неповний крок чесно каже, скільки ще: 12 → 5, 10, «Показати ще 2», 12', async () => {
    searchVideos.mockResolvedValue(found(12))
    const w = await openAndSearch()
    await more(w).trigger('click')
    expect(titles(w)).toHaveLength(10)
    expect(more(w).text()).toBe('Показати ще 2')
    await more(w).trigger('click')
    expect(titles(w)).toHaveLength(12)
    expect(more(w).exists()).toBe(false)
    expect(allShown(w).exists()).toBe(true)
    expect(searchVideos).toHaveBeenCalledTimes(1)
  })

  it('5 і менше — кнопки немає одразу, підказка є', async () => {
    searchVideos.mockResolvedValue(found(3))
    const w = await openAndSearch()
    expect(titles(w)).toHaveLength(3)
    expect(more(w).exists()).toBe(false)
    expect(allShown(w).exists()).toBe(true)
  })

  it('нічого не знайдено — ні кнопки, ні підказки «інші слова», лише наявне «Нічого не знайшлося»', async () => {
    searchVideos.mockResolvedValue(found(0))
    const w = await openAndSearch()
    expect(more(w).exists()).toBe(false)
    expect(allShown(w).exists()).toBe(false)
    expect(w.text()).toContain(P.empty)
  })

  it('помилка пошуку — ні кнопки, ні підказки', async () => {
    searchVideos.mockRejectedValue({ response: { data: { error: 'video_search_quota' } } })
    const w = await openAndSearch()
    expect(more(w).exists()).toBe(false)
    expect(allShown(w).exists()).toBe(false)
    expect(w.text()).toContain(P.quota)
  })

  it('новий пошук скидає показ до 5', async () => {
    searchVideos.mockResolvedValueOnce(found(20, 'a')).mockResolvedValueOnce(found(20, 'b'))
    const w = await openAndSearch('дроби')
    await more(w).trigger('click')
    await more(w).trigger('click')
    expect(titles(w)).toHaveLength(15)

    await search(w, 'відсотки')
    expect(searchVideos).toHaveBeenCalledTimes(2)
    expect(titles(w)).toHaveLength(5)
    expect(titles(w)[0]).toContain('Відео b1')
    expect(more(w).text()).toBe('Показати ще 5')
  })

  it('повторне відкриття вікна теж починає з 5', async () => {
    searchVideos.mockResolvedValue(found(20))
    const w = await openAndSearch()
    await more(w).trigger('click')
    expect(titles(w)).toHaveLength(10)
    await w.setProps({ visible: false })
    await w.setProps({ visible: true })
    await flushPromises()
    await search(w, 'дроби')
    expect(titles(w)).toHaveLength(5)
  })

  it('«Скасувати» в підтвердженні повертає до того самого місця переліку', async () => {
    searchVideos.mockResolvedValue(found(20))
    const w = await openAndSearch()
    await more(w).trigger('click')
    const tenth = w.findAll('[data-testid="yt-search-results"] button')[9]
    await tenth.trigger('click')
    expect(w.find('[data-testid="yt-pick-confirm"]').text()).toContain('Відео v10')
    await w.find('[data-testid="yt-pick-cancel"]').trigger('click')
    expect(titles(w)).toHaveLength(10)
    expect(searchVideos).toHaveBeenCalledTimes(1)
  })
})
