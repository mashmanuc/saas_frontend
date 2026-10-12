/**
 * Запит автозбереження відео з дошки в «Матеріали» — ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11 §1 п.3.
 *
 * Поле — `added_from: 'board'`, НЕ `origin`: `origin` у POST «Матеріалів» належить знімкам
 * «Дзеркала» (Б-177), і сервер відхиляє будь-яке інше його значення (`400 invalid_origin`)
 * ще до гілки YouTube — автозбереження мовчки б не працювало.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/utils/apiClient', () => ({ default: { post, get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import { rememberBoardVideo } from '../api/library'

describe('rememberBoardVideo', () => {
  beforeEach(() => { post.mockReset(); post.mockResolvedValue({ id: 1 }) })

  it('шле youtube_url + added_from=board + назву; поля origin немає', async () => {
    await rememberBoardVideo('https://youtu.be/abcdefghijk', '  Дроби  ')
    expect(post).toHaveBeenCalledTimes(1)
    const [url, body] = post.mock.calls[0]
    expect(url).toBe('/v1/winterboard/library/assets/')
    expect(body).toEqual({ youtube_url: 'https://youtu.be/abcdefghijk', added_from: 'board', title: 'Дроби' })
    expect(body).not.toHaveProperty('origin')
  })

  it('без назви — поля title немає (назву візьме адаптер на сервері)', async () => {
    await rememberBoardVideo('https://youtu.be/abcdefghijk', '')
    expect(post.mock.calls[0][1]).toEqual({ youtube_url: 'https://youtu.be/abcdefghijk', added_from: 'board' })
  })
})
