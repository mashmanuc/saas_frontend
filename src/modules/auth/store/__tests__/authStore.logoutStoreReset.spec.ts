// Б-35: вихід в іншій вкладці не скидав стори попереднього користувача.
//
// forceLogout брав this.$pinia, а в сторі Pinia 3 такої властивості немає:
// у node_modules/pinia/dist/pinia.mjs 3.0.4 `$pinia` присвоюється лише
// app.config.globalProperties (компоненти) і globalThis (devtools), у стора є
// тільки `_p`. Тож цикл $reset() з v0.87.1 (6cdd32ed, 2026-02-06) не стартував
// жодного разу. Власну вкладку рятує перезавантаження після logout(); інша
// вкладка (initStorageSync → forceLogout('other_tab_logout')) лишається без
// нього, і дані першого користувача живуть у сторах, аж поки в тій самій
// вкладці не увійде наступний.
//
// Інваріанти:
//  - вихід в іншій вкладці скидає стори з даними користувача (options-стори —
//    вбудованим $reset, setup-стори — власним);
//  - стор, який скинути не вдалося, не зникає мовчки (LAW §12): помилка в
//    консолі з назвою стора, решта сторів однаково скинута.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia, defineStore } from 'pinia'
import { ref } from 'vue'

vi.mock('../../api/authApi', () => ({
  default: {
    refresh: vi.fn(),
    csrf: vi.fn(async () => ({ csrf: 'csrf-token' })),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}))
vi.mock('../../../../utils/tokenVault', () => ({
  tokenVault: {
    init: vi.fn(async () => undefined),
    encrypt: vi.fn(async (value: string) => `enc:${value}`),
    decrypt: vi.fn(async (value: string) => value.replace(/^enc:/, '')),
  },
}))
vi.mock('../../../../utils/telemetry/authEvents', () => ({
  logAuthEvent: vi.fn(),
  AUTH_EVENTS: {},
}))
vi.mock('../../../../utils/telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('../../../../app/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}))
vi.mock('../../../../services/realtime', () => ({
  realtimeService: { subscribe: vi.fn() },
}))

import { useAuthStore } from '../authStore'
import { resetAuthDeath } from '../../../../core/auth/onAuthDeath'
import { realtimeService } from '../../../../services/realtime'
import { useLimitsStore } from '../../../../stores/limitsStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useNegotiationChatStore } from '../../../../stores/negotiationChatStore'
import { useNotifyStore } from '../../../../stores/notifyStore'
import { useCalendarWeekStore } from '../../../booking/stores/calendarWeekStore'

// Дані користувача в options-сторі: $reset дає сама Pinia.
const useContactsProbe = defineStore('probe-contacts', {
  state: () => ({ contacts: [] as string[] }),
})

// Setup-стор із власним $reset — як billingStore чи contactsStore.
const useThreadsProbe = defineStore('probe-threads', () => {
  const threads = ref<string[]>([])
  function $reset() {
    threads.value = []
  }
  return { threads, $reset }
})

// Setup-стор без $reset: Pinia поза продом кидає, у проді мовчки нічого не робить.
const useNoResetProbe = defineStore('probe-no-reset', () => {
  const secret = ref('')
  return { secret }
})

type AuthStore = ReturnType<typeof useAuthStore>

// Інша вкладка зробила logout: storage.clearAll() прибрав позначку сесії.
async function otherTabLoggedOut(auth: AuthStore) {
  const forceLogout = vi.spyOn(auth, 'forceLogout')
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'auth_session',
    oldValue: '1',
    newValue: null,
  }))
  expect(forceLogout).toHaveBeenCalledWith('other_tab_logout')
  // Обробник подій forceLogout не чекає — дочекатися його тут.
  await forceLogout.mock.results[0].value
}

describe('authStore.forceLogout: стори попереднього користувача (Б-35)', () => {
  let stopStorageSync: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    resetAuthDeath()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    stopStorageSync?.()
    stopStorageSync = undefined
    vi.restoreAllMocks()
  })

  it('вихід в іншій вкладці скидає стори з даними користувача, а стор auth — ні', async () => {
    localStorage.setItem('auth_session', '1')
    const auth = useAuthStore()
    stopStorageSync = auth.initStorageSync()
    auth.showSessionRevokedBanner = true  // скинути його міг би лише auth.$reset()

    const contacts = useContactsProbe()
    const threads = useThreadsProbe()
    contacts.contacts.push('учень першого вчителя')
    threads.threads.push('листування першого вчителя')

    await otherTabLoggedOut(auth)

    expect(auth.access).toBeNull()
    expect(contacts.contacts).toEqual([])
    expect(threads.threads).toEqual([])
    expect(auth.showSessionRevokedBanner).toBe(true)
  })

  it('вкладка, що увійшла сама (не через bootstrap), теж чує вихід в іншій вкладці', async () => {
    // Слухача тут не ставимо руками: його має поставити сам вхід (setAuth).
    // До 2026-09-26 це робив лише _doBootstrap — вкладка після форми входу,
    // Google, MFA чи WebAuthn вихід в іншій вкладці пропускала повністю.
    const auth = useAuthStore()
    await auth.setAuth({ access: 'jwt-token', user: { id: 7, role: 'tutor', email: 't@example.test' } })
    stopStorageSync = () => auth.dispose()
    const contacts = useContactsProbe()
    contacts.contacts.push('учень першого вчителя')

    await otherTabLoggedOut(auth)

    expect(auth.access).toBeNull()
    expect(contacts.contacts).toEqual([])
  })

  it('справжні стори: ліміти користувача скинуто, мову інтерфейсу (стор документа) — ні', async () => {
    localStorage.setItem('auth_session', '1')
    const auth = useAuthStore()
    stopStorageSync = auth.initStorageSync()
    const limits = useLimitsStore()
    const settings = useSettingsStore()
    const notify = useNotifyStore()
    limits.limits = [{ limit_type: 'tutor_accept', remaining: 3 } as any]
    settings.locale = 'en'
    // Тост про сам вихід показують поруч із forceLogout — скидання його б стерло.
    notify.items = [{ id: 'session-expired', message: 'Сесію завершено' } as any]

    await otherTabLoggedOut(auth)

    expect(limits.limits).toEqual([])
    expect(settings.locale).toBe('en')
    expect(notify.items).toHaveLength(1)
  })

  it('календар: слот, схований попереднім вчителем, наступному не схований (поле поза $state)', async () => {
    localStorage.setItem('auth_session', '1')
    const auth = useAuthStore()
    stopStorageSync = auth.initStorageSync()
    const calendar = useCalendarWeekStore()
    calendar.markSlotAsDeleted(123)

    await otherTabLoggedOut(auth)

    // Наступний вчитель у цій самій вкладці отримує свій тиждень зі слотом 123.
    calendar.snapshot = { accessible: [{ id: 123 }], days: [], events: [], blockedRanges: [] } as any
    expect(calendar.accessible.map((slot: { id: number }) => slot.id)).toEqual([123])
  })

  it('чат переговорів при виході відписується від каналу треду (відписка живе поза станом)', async () => {
    const unsubscribeThread = vi.fn()
    vi.mocked(realtimeService.subscribe).mockReturnValue(unsubscribeThread)
    localStorage.setItem('auth_session', '1')
    const auth = useAuthStore()
    stopStorageSync = auth.initStorageSync()
    const chat = useNegotiationChatStore()
    chat.setActiveThread('thread-1')
    expect(realtimeService.subscribe).toHaveBeenCalledWith('chat:thread:thread-1', expect.any(Function))

    await otherTabLoggedOut(auth)

    expect(unsubscribeThread).toHaveBeenCalledTimes(1)
    expect(chat.activeThreadId).toBeNull()
  })

  it('стор, який скинути не вдалося, видно в консолі з назвою; решту скинуто', async () => {
    localStorage.setItem('auth_session', '1')
    const auth = useAuthStore()
    stopStorageSync = auth.initStorageSync()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const noReset = useNoResetProbe()
    const contacts = useContactsProbe()
    noReset.secret = 'дані першого вчителя'
    contacts.contacts.push('учень першого вчителя')

    await otherTabLoggedOut(auth)

    expect(contacts.contacts).toEqual([])
    const logged = consoleError.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
    expect(logged).toContain('probe-no-reset')
  })
})
