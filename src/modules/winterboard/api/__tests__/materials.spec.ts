import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import apiClient from '@/utils/apiClient'
import materialsApi from '../materials'

const BASE = '/v1/winterboard/materials'

describe('materials API', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({} as never)
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({} as never)
    vi.mocked(apiClient.delete).mockReset().mockResolvedValue({} as never)
  })

  it('read() — GET на витяг', async () => {
    await materialsApi.read(7)
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/7/extract/`)
  })

  it('extract() шле pages і force', async () => {
    await materialsApi.extract(7, [1, 2], true)
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/7/extract/`, { pages: [1, 2], force: true })
  })

  it('extract() без аргументів не форсує', async () => {
    await materialsApi.extract(7)
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/7/extract/`, { pages: undefined, force: false })
  })

  it('confirm() бʼє в окремий шлях і шле сторінки', async () => {
    await materialsApi.confirm(7, [3])
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/7/extract/confirm/`, { pages: [3] })
  })

  it('reset() — DELETE', async () => {
    await materialsApi.reset(7)
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/7/extract/`)
  })

  it('не розгортає .data.data — apiClient уже віддає тіло', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ pages: [{ page_no: 1 }] } as never)
    const res = await materialsApi.read(7)
    expect(res.pages).toHaveLength(1)
  })
})
