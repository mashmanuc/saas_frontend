/**
 * «Сценарій» §4.1 (рішення власника 2026-09-28): відео й аудіо згортаються, як інші картки.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * TLV2-05B свідомо не згортав медіа: сховане відео грало б звук, а перемонтування
 * скинуло б відтворення. Власник сказав «кожний можна згорнути» — тож обидві умови
 * мусять виконуватись завжди, інакше в класі лишиться звук невидимого відео.
 *
 * ІНВАРІАНТИ
 *   INV-MIN-1  медіа згортаються тим самим правилом, що картки (`canMinimize`): лише
 *              вчитель у режимі редагування
 *   INV-MIN-2  згорнутий програвач мовчить НА КОЖНОМУ ЕКРАНІ: відео-файл, аудіо й
 *              YouTube самі ставлять свій плеєр на паузу, щойно бачать `minimized`
 *              (за даними — і в учня, і після перезавантаження, коли вже згорнуто)
 *   INV-MIN-3  згорнуте медіа лишається ЗМОНТОВАНИМ (display:none, не v-if) — інакше
 *              «Повернути» почало б відео спочатку
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Кожен тест — свої екземпляри: забутий згорнутий плеєр з тим самим id реагував би
// на стан наступного тесту (так і має бути в житті, але не між тестами).
enableAutoUnmount(afterEach)

const { ytPause } = vi.hoisted(() => ({ ytPause: vi.fn(() => true) }))

vi.mock('../board/youtubeRemoteControl', async () => {
  const { reactive } = await import('vue')
  return {
    registerYouTubeFrame: vi.fn(),
    unregisterYouTubeFrame: vi.fn(),
    pauseVideo: ytPause,
    ytPlayStates: reactive({}),
  }
})

import { canMinimize } from '../board/boardTray'
import { ytPlayStates } from '../board/youtubeRemoteControl'
import VideoPlayerObject from '../components/board/objects/VideoPlayerObject.vue'
import AudioPlayerObject from '../components/board/objects/AudioPlayerObject.vue'
import YouTubePlayerObject from '../components/board/objects/YouTubePlayerObject.vue'
import type { WBAsset } from '../types/winterboard'

const base = { x: 10, y: 20, w: 320, h: 180, zIndex: 1 }
const video = (minimized = false) => ({ id: 'vid-1', type: 'video_player' as const, src: '/v.mp4', title: 'Досліди', ...base, minimized })
const audio = (minimized = false) => ({ id: 'aud-1', type: 'audio_player' as const, src: '/a.mp3', title: 'Пісня', ...base, minimized })
const youtube = (minimized = false) => ({
  id: 'yt-1', type: 'youtube_player' as const, src: '', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ...base, minimized,
})

let pauseSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  ytPause.mockClear()
  pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { pauseSpy.mockRestore() })

const mountVideo = (obj: ReturnType<typeof video>, isTutor = true) => mount(VideoPlayerObject, {
  props: { obj, isTutor, videoStates: {}, sendPlay: vi.fn(), sendPause: vi.fn(), sendSeek: vi.fn() },
})

describe('INV-MIN-1 · медіа згортаються тим самим правилом, що картки', () => {
  it('учитель у редагуванні може згорнути відео-файл, аудіо й YouTube', () => {
    for (const asset of [video(), audio(), youtube()]) {
      expect(canMinimize(asset as unknown as WBAsset, { isTutor: true, mode: 'edit' }), asset.type).toBe(true)
    }
  })

  it('учень, режим перегляду або вже згорнуте — ні', () => {
    const v = video() as unknown as WBAsset
    expect(canMinimize(v, { isTutor: false, mode: 'edit' })).toBe(false)
    expect(canMinimize(v, { isTutor: true, mode: 'readonly' })).toBe(false)
    expect(canMinimize(video(true) as unknown as WBAsset, { isTutor: true, mode: 'edit' })).toBe(false)
  })
})

describe('INV-MIN-2 · згорнутий програвач мовчить на кожному екрані', () => {
  it('відео-файл: учитель і учень ставлять свій <video> на паузу, щойно бачать minimized', async () => {
    for (const isTutor of [true, false]) {
      pauseSpy.mockClear()
      const w = mountVideo(video(false), isTutor)
      await nextTick()
      expect(pauseSpy, `до згортання, isTutor=${isTutor}`).not.toHaveBeenCalled()
      await w.setProps({ obj: video(true) })
      await nextTick()
      expect(pauseSpy, `після згортання, isTutor=${isTutor}`).toHaveBeenCalled()
      w.unmount()
    }
  })

  it('аудіо: програвач учителя стає на паузу; в учня програвача немає — нічого не падає', async () => {
    const tutor = mount(AudioPlayerObject, { props: { obj: audio(false), isTutor: true } })
    await nextTick()
    expect(pauseSpy).not.toHaveBeenCalled()
    await tutor.setProps({ obj: audio(true) })
    await nextTick()
    expect(pauseSpy).toHaveBeenCalled()

    pauseSpy.mockClear()
    const student = mount(AudioPlayerObject, { props: { obj: audio(false), isTutor: false } })
    expect(student.find('audio').exists()).toBe(false)
    await student.setProps({ obj: audio(true) })
    await nextTick()
    expect(pauseSpy).not.toHaveBeenCalled()
  })

  it('YouTube: пауза через плеєр цього екрана, у вчителя й учня однаково', async () => {
    for (const isTutor of [true, false]) {
      ytPause.mockClear()
      const w = mount(YouTubePlayerObject, { props: { obj: youtube(false), isTutor } })
      await nextTick()
      expect(ytPause).not.toHaveBeenCalled()
      await w.setProps({ obj: youtube(true) })
      await nextTick()
      expect(ytPause).toHaveBeenCalledWith('yt-1')
      w.unmount()
    }
  })

  it('після перезавантаження вже згорнуте — пауза одразу при появі (дані, а не дія)', async () => {
    mountVideo(video(true))
    mount(YouTubePlayerObject, { props: { obj: youtube(true), isTutor: false } })
    await nextTick()
    expect(pauseSpy).toHaveBeenCalled()
    expect(ytPause).toHaveBeenCalledWith('yt-1')
  })

  it('старт відтворення, поки згорнуто (синхронізація, рідні кнопки) — одразу пауза', async () => {
    const v = mountVideo(video(true), false)
    await nextTick()
    pauseSpy.mockClear()
    await v.find('video').trigger('play')
    expect(pauseSpy).toHaveBeenCalled()

    const a = mount(AudioPlayerObject, { props: { obj: audio(true), isTutor: true } })
    await nextTick()
    pauseSpy.mockClear()
    await a.find('audio').trigger('play')
    expect(pauseSpy).toHaveBeenCalled()

    // незгорнуте — старт не глушиться
    const free = mountVideo(video(false))
    await nextTick()
    pauseSpy.mockClear()
    await free.find('video').trigger('play')
    expect(pauseSpy).not.toHaveBeenCalled()
  })

  it('YouTube «ожив» уже після згортання (плеєр ще не був готовий) — пауза, щойно каже «грає»', async () => {
    const w = mount(YouTubePlayerObject, { props: { obj: youtube(true), isTutor: true } })
    await nextTick()
    ytPause.mockClear()
    ;(ytPlayStates as Record<string, string>)['yt-1'] = 'playing'
    await nextTick()
    expect(ytPause).toHaveBeenCalledWith('yt-1')
    // незгорнутий, що грає, — не чіпаємо
    await w.setProps({ obj: youtube(false) })
    ytPause.mockClear()
    ;(ytPlayStates as Record<string, string>)['yt-1'] = 'paused'
    await nextTick()
    ;(ytPlayStates as Record<string, string>)['yt-1'] = 'playing'
    await nextTick()
    expect(ytPause).not.toHaveBeenCalled()
    delete (ytPlayStates as Record<string, string>)['yt-1']
  })

  it('повернення з трею саме не запускає відтворення (учитель тисне ▶)', async () => {
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    const w = mountVideo(video(true))
    await w.setProps({ obj: video(false) })
    await nextTick()
    expect(playSpy).not.toHaveBeenCalled()
    playSpy.mockRestore()
  })
})

describe('INV-MIN-3 · згорнуте медіа лишається змонтованим', () => {
  it('WBCanvas ховає медіа-оверлей стилем display:none, а не v-if', () => {
    const src = readFileSync(resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')
    const start = src.indexOf('v-for="asset in mediaAssets"')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, src.indexOf('</template>', start))
    expect(block).toContain("isMinimizedOnBoard(asset) ? { display: 'none' } : {}")
    expect(block).not.toMatch(/v-if="[^"]*isMinimizedOnBoard/)
    // джерело списку — усі медіа, згорнуті теж (не відфільтровані з рендеру)
    expect(src).toMatch(/const mediaAssets = computed\(\(\) =>\s*assets\.value\.filter\(a => a\.type === 'audio_player'/)
  })
})
