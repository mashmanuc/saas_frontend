import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import apiClient from '@/utils/apiClient'
import courseApi from '../api/courseApi'

const BASE = '/v1/lesson-constructor/courses'

describe('courseApi', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({} as never)
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({} as never)
  })

  it('plan() бʼє в /plan/ і загортає spec', async () => {
    const spec = { title: 'К', level: '5', n_lessons: 4 }
    await courseApi.plan(spec)
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/plan/`, { spec })
  })

  it('list() — GET на корінь', async () => {
    await courseApi.list()
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/`)
  })

  it('create() шле spec і plan', async () => {
    const spec = { title: 'К', level: '5', n_lessons: 4 }
    await courseApi.create(spec, undefined)
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/`, { spec, plan: undefined })
  })

  it('detail() — GET з id', async () => {
    await courseApi.detail(7)
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/7/`)
  })

  it('materialize() шле orders', async () => {
    await courseApi.materialize(7, [1, 3])
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/7/materialize/`, { orders: [1, 3] })
  })

  it('publish() — POST на /publish/', async () => {
    await courseApi.publish(7)
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/7/publish/`, {})
  })

  it('не розгортає .data.data — apiClient уже віддає тіло', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ courses: [{ id: 1 }] } as never)
    const res = await courseApi.list()
    expect(res.courses).toHaveLength(1)
  })
})
