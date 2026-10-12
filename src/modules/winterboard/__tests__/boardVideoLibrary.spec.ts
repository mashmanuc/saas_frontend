/**
 * Автозбереження відео з дошки в «Матеріали» — ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11 §1 п.3.
 * (1) правило модуля; (2) кімната кличе його рівно там, де картку кладе людина.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createBoardVideoRemember } from '../board/boardVideoLibrary'

const YT = { type: 'youtube_player', src: '', youtubeUrl: 'https://youtu.be/abcdefghijk', title: 'Дроби' }

describe('createBoardVideoRemember', () => {
  it('youtube_player власника → один REST-запит з посиланням і назвою', () => {
    const remember = vi.fn().mockResolvedValue({})
    createBoardVideoRemember({ enabled: () => true, remember })(YT)
    expect(remember).toHaveBeenCalledTimes(1)
    expect(remember).toHaveBeenCalledWith('https://youtu.be/abcdefghijk', 'Дроби')
  })

  it('інший тип об\'єкта — нічого', () => {
    const remember = vi.fn().mockResolvedValue({})
    createBoardVideoRemember({ enabled: () => true, remember })({ type: 'image', src: 'x.png' })
    expect(remember).not.toHaveBeenCalled()
  })

  it('не власник / локальна дошка (enabled=false) — нічого', () => {
    const remember = vi.fn().mockResolvedValue({})
    createBoardVideoRemember({ enabled: () => false, remember })(YT)
    expect(remember).not.toHaveBeenCalled()
  })

  it('без youtubeUrl бере src; порожнє посилання — нічого', () => {
    const remember = vi.fn().mockResolvedValue({})
    const fn = createBoardVideoRemember({ enabled: () => true, remember })
    fn({ type: 'youtube_player', src: 'https://youtu.be/zzzzzzzzzzz' })
    fn({ type: 'youtube_player', src: '  ' })
    expect(remember).toHaveBeenCalledTimes(1)
    expect(remember).toHaveBeenCalledWith('https://youtu.be/zzzzzzzzzzz', undefined)
  })

  it('помилка сервера — видима в журналі, без повтору і без винятку назовні', async () => {
    const remember = vi.fn().mockRejectedValue(new Error('500'))
    const warn = vi.fn()
    expect(() => createBoardVideoRemember({ enabled: () => true, remember, warn })(YT)).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(remember).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('WBSoloRoom — де саме відео потрапляє в «Мої відео»', () => {
  const SRC = readFileSync('src/modules/winterboard/views/WBSoloRoom.vue', 'utf8')

  function body(fnHeader: string): string {
    const start = SRC.indexOf(fnHeader)
    expect(start, fnHeader).toBeGreaterThan(-1)
    return SRC.slice(start, SRC.indexOf('\n}\n', start))
  }

  it('вікно YouTube (handleYouTubeSubmit) — після штатного store.addAsset', () => {
    const b = body('function handleYouTubeSubmit(')
    expect(b.indexOf('store.addAsset(')).toBeGreaterThan(-1)
    expect(b.indexOf('rememberBoardVideoAsset(asset)')).toBeGreaterThan(b.indexOf('store.addAsset('))
  })

  it('пульт і перетягування (handleAssetAdd) — після store.addAsset', () => {
    const b = body('function handleAssetAdd(')
    expect(b.indexOf('rememberBoardVideoAsset(asset)')).toBeGreaterThan(b.indexOf('store.addAsset('))
  })

  it('Ctrl+V (onAssetAdd у буфері) — після store.addAsset', () => {
    // перший onAssetAdd у кімнаті — перетягування з «Матеріалів» (уже там); нам потрібен буфер
    const clip = SRC.indexOf('const boardClipboard = useBoardClipboard({')
    expect(clip).toBeGreaterThan(-1)
    const start = SRC.indexOf('onAssetAdd: (asset: WBAsset) => {', clip)
    const b = SRC.slice(start, SRC.indexOf('\n  },', start))
    expect(b.indexOf('rememberBoardVideoAsset(asset)')).toBeGreaterThan(b.indexOf('store.addAsset('))
  })

  it('лише власник хмарної дошки; вікно отримує режим «Мої відео» з тієї ж умови', () => {
    expect(SRC).toMatch(/const videoLibraryEnabled = computed\(\(\) => isSessionOwner\.value && !!sessionId\.value && !isLocalWorkspace\)/)
    expect(SRC).toMatch(/<WBYouTubeModal[\s\S]*?:library="videoLibraryEnabled"/)
    expect(SRC).toMatch(/enabled: \(\) => videoLibraryEnabled\.value/)
  })

  it('пульт не змінювався: addRemoteVideo і далі кладе через handleAssetAdd', () => {
    const b = body('function addRemoteVideo(')
    expect(b).toContain('handleAssetAdd({')
  })
})
