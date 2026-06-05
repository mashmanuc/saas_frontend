import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { websocketService } from '../websocket'
import { realtimeService } from '../realtime'
import { useNotificationsStore } from '@/stores/notificationsStore'

/**
 * Регресія P0 (2026-06-05): badge не оновлювався в реальному часі.
 *
 * realtimeService.handleMessage вже розгортає зовнішній frame.payload перед
 * передачею в channel-handler. subscribeNotifications розгортав ВДРУГЕ через
 * `data.data`, що повертало deep-link об'єкт без id/title → handleRealtimeNotification
 * дропав подію → unreadCount не інкрементувався без відкриття дропдауна.
 */
describe('websocketService.subscribeNotifications — WS payload unwrap (P0 regression)', () => {
  // Точний кадр як його надсилає Daphne gateway:
  // publisher.publish → enriched_payload → realtime_send → send_json(payload)
  const backendFrame = {
    type: 'LESSON_STARTED',
    payload: {
      id: 'abc-123',
      type: 'LESSON_STARTED',
      title: 'Урок розпочався',
      body: 'Антон чекає на вас',
      data: { lesson_id: '55', room_url: '/winterboard/classroom/55' },
      created_at: '2026-06-05T17:00:00Z',
    },
    priority: 'normal',
    channel: 'notifications_user_92',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    // Скидаємо channel-підписки realtimeService між тестами (singleton)
    ;(realtimeService as any).channelSubscriptions = new Map()
  })

  it('зберігає повний notification-обєкт (id + title) для toast/store', () => {
    const received: any[] = []
    websocketService.subscribeNotifications(92, (event) => received.push(event))

    // Проганяємо крізь realtimeService.handleMessage (unwrap #1)
    ;(realtimeService as any).handleMessage({ data: JSON.stringify(backendFrame) })

    expect(received).toHaveLength(1)
    expect(received[0].type).toBe('LESSON_STARTED')
    // Критична перевірка: payload зберігає id + title (раніше було data.data = {room_url})
    expect(received[0].payload.id).toBe('abc-123')
    expect(received[0].payload.title).toBe('Урок розпочався')
    expect(received[0].payload.body).toBe('Антон чекає на вас')
    expect(received[0].payload.data.room_url).toBe('/winterboard/classroom/55')
  })

  it('інкрементує unreadCount у store коли приходить WS-нотифікація (real-time badge)', () => {
    const store = useNotificationsStore()
    websocketService.subscribeNotifications(92, (event) => store.handleRealtimeNotification(event))

    expect(store.unreadCount).toBe(0)

    ;(realtimeService as any).handleMessage({ data: JSON.stringify(backendFrame) })

    expect(store.unreadCount).toBe(1)
    expect(store.items[0].id).toBe('abc-123')
    expect(store.items[0].title).toBe('Урок розпочався')
  })
})
