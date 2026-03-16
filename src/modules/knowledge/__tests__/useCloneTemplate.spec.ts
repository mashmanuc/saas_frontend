// Phase 14 A3.5: Unit tests for useCloneTemplate composable
// Tests: clone flow, toast, error handling

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock apiClient ──────────────────────────────────────────────────────────

const mockPost = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

// ── Mock useToast ───────────────────────────────────────────────────────────

const mockShowToast = vi.fn()

vi.mock('@/modules/winterboard/composables/useToast', () => ({
  useToast: () => ({
    toasts: { value: [] },
    showToast: mockShowToast,
    dismissToast: vi.fn(),
    clearAllToasts: vi.fn(),
  }),
}))

// ── Import after mocks ─────────────────────────────────────────────────────

import { useCloneTemplate } from '../composables/useCloneTemplate'

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockCloneResult = {
  session_id: 'sess-new',
  session_name: 'З шаблону: Квадратні рівняння',
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useCloneTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct initial state', () => {
    const { isCloning, error } = useCloneTemplate()
    expect(isCloning.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('clones template successfully and shows toast', async () => {
    mockPost.mockResolvedValue(mockCloneResult)
    const { clone, isCloning, error } = useCloneTemplate()

    const result = await clone('tmpl-1')

    expect(mockPost).toHaveBeenCalledWith('/v1/knowledge/lesson-templates/tmpl-1/clone/')
    expect(result).toEqual(mockCloneResult)
    expect(isCloning.value).toBe(false)
    expect(error.value).toBeNull()
    expect(mockShowToast).toHaveBeenCalledWith('Дошку створено з шаблону!', 'success')
  })

  it('handles API error with detail message', async () => {
    mockPost.mockRejectedValue({
      response: { data: { detail: 'Шаблон не доступний' } },
    })
    const { clone, error } = useCloneTemplate()

    const result = await clone('tmpl-1')

    expect(result).toBeNull()
    expect(error.value).toBe('Шаблон не доступний')
    expect(mockShowToast).toHaveBeenCalledWith('Шаблон не доступний', 'error')
  })

  it('handles API error without detail — fallback message', async () => {
    mockPost.mockRejectedValue(new Error('Network error'))
    const { clone, error } = useCloneTemplate()

    const result = await clone('tmpl-1')

    expect(result).toBeNull()
    expect(error.value).toBe('Не вдалося клонувати шаблон')
    expect(mockShowToast).toHaveBeenCalledWith('Не вдалося клонувати шаблон', 'error')
  })

  it('sets isCloning during request', async () => {
    let resolveFn: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((resolve) => { resolveFn = resolve }))
    const { clone, isCloning } = useCloneTemplate()

    const promise = clone('tmpl-1')
    resolveFn!(mockCloneResult)
    await promise
    expect(isCloning.value).toBe(false)
  })

  it('clears previous error on new clone attempt', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'))
    const { clone, error } = useCloneTemplate()

    await clone('tmpl-1')
    expect(error.value).toBe('Не вдалося клонувати шаблон')

    mockPost.mockResolvedValueOnce(mockCloneResult)
    await clone('tmpl-2')
    expect(error.value).toBeNull()
  })
})
