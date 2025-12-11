import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../src/stores/chatStore'

const mockFetchHistory = vi.fn()
const mockSendMessage = vi.fn()
const mockEditMessage = vi.fn()
const mockDeleteMessage = vi.fn()

vi.mock('../../src/api/chat', () => ({
  chatApi: {
    fetchHistory: (...args) => mockFetchHistory(...args),
    sendMessage: (...args) => mockSendMessage(...args),
    editMessage: (...args) => mockEditMessage(...args),
    deleteMessage: (...args) => mockDeleteMessage(...args),
  },
}))

const mockPublish = vi.fn()
const mockSubscribe = vi.fn(() => vi.fn())
const mockOn = vi.fn(() => vi.fn())

vi.mock('../../src/services/realtime', () => ({
  realtimeService: {
    publish: (...args) => mockPublish(...args),
    subscribe: (...args) => mockSubscribe(...args),
    on: (...args) => mockOn(...args),
  },
}))

export const notifyError = vi.fn()
vi.mock('../../src/utils/notify', () => ({
  notifyError: (...args) => notifyError(...args),
}))

const authUser = {
  id: 1,
  full_name: 'Tutor One',
  email: 'tutor@example.com',
}

vi.mock('../../src/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({
    user: authUser,
    access: 'token',
    refreshAccess: vi.fn(),
  }),
}))

describe('chatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockFetchHistory.mockResolvedValue({ results: [] })
  })

  const bootstrapStore = async () => {
    const store = useChatStore()
    await store.initLesson('lesson-1')
    return store
  }

  it('creates optimistic message and replaces it after successful send', async () => {
    const store = await bootstrapStore()
    const serverMessage = {
      id: 99,
      text: 'Hello world',
      created_at: '2024-01-01T00:00:00Z',
      author_id: authUser.id,
    }
    mockSendMessage.mockResolvedValue(serverMessage)

    await store.sendMessage({ text: 'Hello world' })

    expect(mockSendMessage).toHaveBeenCalledWith({
      lesson_id: 'lesson-1',
      text: 'Hello world',
      attachments: undefined,
    })
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].id).toBe(serverMessage.id)
    expect(store.messages[0].status).toBe('delivered')
    expect(store.messages[0].optimistic).toBeFalsy()
    expect(mockPublish).toHaveBeenCalledWith('chat', expect.objectContaining({ type: 'chat.message.new' }))
  })

  it('marks message as error and allows retry after failure', async () => {
    const store = await bootstrapStore()
    mockSendMessage.mockRejectedValueOnce({
      response: { data: { detail: 'Server down' } },
    })

    await store.sendMessage({ text: 'Failure case' })

    expect(notifyError).toHaveBeenCalledWith('Server down')
    expect(store.messages).toHaveLength(1)
    const failedMessage = store.messages[0]
    expect(failedMessage.status).toBe('error')

    const retryResponse = {
      id: 7,
      text: failedMessage.text,
      created_at: '2024-01-01T00:00:01Z',
      author_id: authUser.id,
    }
    mockSendMessage.mockResolvedValueOnce(retryResponse)

    // Clear rate-limit lock before retry
    store.clearSendCooldown()

    await store.retryMessage(failedMessage.id)

    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(store.messages[0].id).toBe(retryResponse.id)
    expect(store.messages[0].status).toBe('delivered')
  })

  it('merges websocket payload by clientId and clears optimistic flag', async () => {
    const store = await bootstrapStore()
    const tempId = store.addOptimisticMessage({
      text: 'WS message',
      author: authUser,
    })

    // Use replaceOptimisticMessage which explicitly clears optimistic flag
    store.replaceOptimisticMessage(tempId, {
      id: 123,
      clientId: tempId,
      text: 'WS message',
      created_at: '2024-01-01T00:00:05Z',
      author_id: authUser.id,
    })

    expect(store.messages.some((msg) => msg.id === tempId)).toBe(false)
    const merged = store.messages.find((msg) => msg.id === 123)
    expect(merged).toBeTruthy()
    expect(merged.optimistic).toBeFalsy()
    expect(merged.status).toBe('delivered')
  })
})
