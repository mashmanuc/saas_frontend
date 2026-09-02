import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BillingPayView from '../BillingPayView.vue'

const mockPush = vi.fn()
let mockQuery: Record<string, unknown> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: mockQuery }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const mockLoadPaddle = vi.fn()
vi.mock('../../utils/paddleLoader', () => ({
  loadPaddle: (...args: unknown[]) => mockLoadPaddle(...args),
}))

function makePaddle() {
  return {
    Environment: { set: vi.fn() },
    Initialize: vi.fn(),
    Checkout: { open: vi.fn() },
  }
}

describe('BillingPayView', () => {
  beforeEach(() => {
    mockQuery = {}
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('sandbox: sets environment, initializes with token + successUrl, reopen button opens the transaction', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_tok')
    vi.stubEnv('VITE_PADDLE_ENV', 'sandbox')
    mockQuery = { _ptxn: 'txn_123' }
    const paddle = makePaddle()
    mockLoadPaddle.mockResolvedValue(paddle)

    const wrapper = mount(BillingPayView)
    await flushPromises()

    expect(paddle.Environment.set).toHaveBeenCalledWith('sandbox')
    expect(paddle.Initialize).toHaveBeenCalledTimes(1)
    const init = paddle.Initialize.mock.calls[0][0]
    expect(init.token).toBe('test_tok')
    expect(init.checkout.settings.displayMode).toBe('overlay')
    expect(init.checkout.settings.successUrl).toMatch(/\/tutor\/billing\/success$/)
    expect(wrapper.text()).toContain('billing.pay.ready')

    await wrapper.find('[data-testid="paddle-reopen"]').trigger('click')
    expect(paddle.Checkout.open).toHaveBeenCalledWith({ transactionId: 'txn_123' })
  })

  it('live: does not touch Environment (Paddle.js defaults to production)', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'live_tok')
    vi.stubEnv('VITE_PADDLE_ENV', 'live')
    mockQuery = { _ptxn: 'txn_live' }
    const paddle = makePaddle()
    mockLoadPaddle.mockResolvedValue(paddle)

    mount(BillingPayView)
    await flushPromises()

    expect(paddle.Environment.set).not.toHaveBeenCalled()
    expect(paddle.Initialize).toHaveBeenCalledTimes(1)
  })

  it('missing _ptxn: shows the invalid-link message and never loads Paddle.js', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_tok')
    mockQuery = {}

    const wrapper = mount(BillingPayView)
    await flushPromises()

    expect(wrapper.text()).toContain('billing.pay.missingTxn')
    expect(mockLoadPaddle).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="paddle-reopen"]').exists()).toBe(false)
  })

  it('missing client token: shows not-configured and never loads Paddle.js', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', '')
    mockQuery = { _ptxn: 'txn_123' }

    const wrapper = mount(BillingPayView)
    await flushPromises()

    expect(wrapper.text()).toContain('billing.pay.notConfigured')
    expect(mockLoadPaddle).not.toHaveBeenCalled()
  })

  it('loader failure: shows load-failed message, no Initialize', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_tok')
    mockQuery = { _ptxn: 'txn_123' }
    mockLoadPaddle.mockRejectedValue(new Error('paddle_load_failed'))

    const wrapper = mount(BillingPayView)
    await flushPromises()

    expect(wrapper.text()).toContain('billing.pay.loadFailed')
  })

  it('back button navigates to account billing', async () => {
    mockQuery = {}
    const wrapper = mount(BillingPayView)
    await flushPromises()

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'account-billing' })
  })
})
