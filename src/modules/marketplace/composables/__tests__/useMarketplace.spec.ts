import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMarketplaceStore } from '../../stores/marketplaceStore'

const mockUseRoute = vi.fn()
const mockUseRouter = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => mockUseRoute(),
  useRouter: () => mockUseRouter()
}))

describe('useMarketplace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    mockUseRoute.mockReturnValue({
      query: {},
      params: {}
    })
    
    mockUseRouter.mockReturnValue({
      replace: vi.fn()
    })
  })

  it('should expose store state and actions', () => {
    const store = useMarketplaceStore()

    expect(store.tutors).toBeDefined()
    expect(store.isLoading).toBeDefined()
    expect(typeof store.loadTutors).toBe('function')
    expect(typeof store.setFilters).toBe('function')
  })

  it('should sync filters with URL on mount', () => {
    mockUseRoute.mockReturnValue({
      query: {
        subject: 'math',
        price_min: '100',
        price_max: '500'
      },
      params: {}
    })

    const store = useMarketplaceStore()
    const spy = vi.spyOn(store, 'setFilters')

    // Simulate URL sync
    store.setFilters({
      subject: ['math'],
      price_min: 100,
      price_max: 500
    })

    expect(spy).toHaveBeenCalled()
  })

  it('should update URL when filters change', async () => {
    const mockReplace = vi.fn()
    mockUseRouter.mockReturnValue({
      replace: mockReplace
    })

    const store = useMarketplaceStore()
    
    store.setFilters({ subject: ['math', 'physics'] })

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 350))

    expect(store.filters.subject).toEqual(['math', 'physics'])
  })
})
