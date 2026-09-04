import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  locale: { value: 'en' },
  post: vi.fn(),
}))

vi.mock('../../../utils/apiClient', () => ({
  default: { post: (...args) => state.post(...args) },
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { locale: state.locale } },
}))

import { sendIntent } from '../sendIntent'

describe('sendIntent — provenance locale', () => {
  beforeEach(() => {
    state.post.mockReset()
    state.post.mockResolvedValue({ data: { ok: true } })
    state.locale.value = 'en'
  })

  it('передає англійську локаль, щоб EN_GUIDE міг відсікти помилкову дію на сервері', async () => {
    await sendIntent('CREATE', [{ type: 'Board' }], 'command-palette')

    const [, body] = state.post.mock.calls[0]
    expect(body.provenance).toEqual({ client_id: 'command-palette', locale: 'en' })
  })

  it('зберігає безпечний український fallback для старого виклику без локалі', async () => {
    state.locale.value = ''
    await sendIntent('CREATE', [{ type: 'Board' }], 'command-palette')

    const [, body] = state.post.mock.calls[0]
    expect(body.provenance.locale).toBe('uk')
  })
})
