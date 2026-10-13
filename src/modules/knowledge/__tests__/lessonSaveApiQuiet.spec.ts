// Папки й переміщення — без загального «Завантаження…» (2026-10-13): затемнення сторінки на кожен
// швидкий запит читалось як блимання при переміщенні уроку.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ folders: [] }),
    post: vi.fn().mockResolvedValue({ moved_count: 2 }),
  },
}))

import apiClient from '@/utils/apiClient'
import { lessonSaveApi } from '../api/lessonSaveApi'

describe('lessonSaveApi — тихі запити папок', () => {
  it('перелік папок і переміщення не вмикають загальний лоадер', async () => {
    await lessonSaveApi.getFolders()
    await lessonSaveApi.bulkMove(['L1', 'L2'], 'f1')
    expect(vi.mocked(apiClient.get).mock.calls[0][1]).toMatchObject({ meta: { skipLoader: true } })
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toMatchObject({ meta: { skipLoader: true } })
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toEqual({ lesson_ids: ['L1', 'L2'], folder_id: 'f1' })
  })
})
