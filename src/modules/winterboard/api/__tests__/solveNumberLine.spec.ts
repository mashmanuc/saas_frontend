/**
 * Б-184 · «Розвʼязати»: будь-яка невдача — відмова нашою формою, і з правдивою причиною
 * (рев'ю 13.10, п. 4): мережа і 500 — не «сервер зайнятий».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({ default: { post: vi.fn() } }))

import apiClient from '@/utils/apiClient'
import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'

const post = vi.mocked(apiClient.post)

describe('winterboardApi.solveNumberLine', () => {
  beforeEach(() => { post.mockClear() })

  it('відмова сервера нашою формою — як прийшла (і 403 «не пілот»)', async () => {
    post.mockRejectedValue({ response: { status: 403, data: { ok: false, reason: 'not_pilot', detail: 'пілот' } } })
    expect(await winterboardApi.solveNumberLine('x > 1')).toEqual({ ok: false, reason: 'not_pilot', detail: 'пілот' })
  })

  it('немає відповіді (мережа) — network', async () => {
    post.mockRejectedValue(new Error('Network Error'))
    expect(await winterboardApi.solveNumberLine('x > 1')).toMatchObject({ ok: false, reason: 'network' })
  })

  it('500 без нашої форми — server_error, не busy', async () => {
    post.mockRejectedValue({ response: { status: 500, data: '<html>' } })
    expect(await winterboardApi.solveNumberLine('x > 1')).toMatchObject({ ok: false, reason: 'server_error' })
  })
})
