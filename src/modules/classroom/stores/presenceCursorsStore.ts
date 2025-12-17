import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notifyError, notifyWarning } from '@/utils/notify'
import {
  ClassroomPresenceClient,
  type ClassroomWsRole,
  type ServerToClientMsg,
} from '../realtime/classroomPresenceClient'

export type RemoteCursor = {
  userId: string
  x: number
  y: number
  tool: string
  color: string
  ts: number
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function jitter(ms: number): number {
  const j = ms * 0.2
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * j))
}

export const usePresenceCursorsStore = defineStore('presenceCursors', () => {
  const state = ref<ConnectionState>('disconnected')

  const client = ref<ClassroomPresenceClient | null>(null)
  const remoteCursors = ref<Record<string, RemoteCursor>>({})
  const presentUsers = ref<Record<string, { role?: string; lastSeenTs: number }>>({})

  const followTeacherEnabled = ref(false)
  const teacherUserId = ref<string | null>(null)

  // Local send throttle
  const lastCursorSentAt = ref(0)
  const MIN_CURSOR_INTERVAL_MS = 50 // 20/s

  // reconnect/backoff
  const backoffMs = ref(1000)
  const MAX_BACKOFF_MS = 15000
  let reconnectAbort = false

  const cursorsList = computed(() => Object.values(remoteCursors.value))

  const teacherCursor = computed(() => {
    if (!teacherUserId.value) return null
    return remoteCursors.value[teacherUserId.value] ?? null
  })

  function resetRuntime(): void {
    remoteCursors.value = {}
    presentUsers.value = {}
    teacherUserId.value = null
    followTeacherEnabled.value = false
    lastCursorSentAt.value = 0
    backoffMs.value = 1000
  }

  function setFollowTeacher(enabled: boolean): void {
    followTeacherEnabled.value = enabled
  }

  function initTeacher(userId: string | null): void {
    teacherUserId.value = userId
  }

  function handleServerMessage(msg: ServerToClientMsg): void {
    if (msg.type === 'presence.join') {
      presentUsers.value = {
        ...presentUsers.value,
        [msg.userId]: { role: msg.role, lastSeenTs: msg.ts },
      }
      if (msg.role === 'teacher') {
        teacherUserId.value = msg.userId
      }
      return
    }

    if (msg.type === 'presence.leave') {
      const next = { ...presentUsers.value }
      delete next[msg.userId]
      presentUsers.value = next

      const nextC = { ...remoteCursors.value }
      delete nextC[msg.userId]
      remoteCursors.value = nextC

      if (teacherUserId.value === msg.userId) {
        teacherUserId.value = null
        followTeacherEnabled.value = false
      }
      return
    }

    if (msg.type === 'cursor.update') {
      // do not store own cursor here; server may echo - ok
      remoteCursors.value = {
        ...remoteCursors.value,
        [msg.userId]: {
          userId: msg.userId,
          x: msg.x,
          y: msg.y,
          tool: msg.tool,
          color: msg.color,
          ts: msg.ts,
        },
      }

      presentUsers.value = {
        ...presentUsers.value,
        [msg.userId]: { role: presentUsers.value[msg.userId]?.role, lastSeenTs: msg.ts },
      }
      return
    }

    if (msg.type === 'error') {
      // Message-level errors are optional; close code is authoritative.
      return
    }
  }

  async function connect(opts: {
    wsBaseUrl: string
    classId: string
    sessionId: string
    token: string
    userId: string
    role: ClassroomWsRole
  }): Promise<void> {
    disconnect()
    resetRuntime()

    reconnectAbort = false
    state.value = 'connecting'

    const c = new ClassroomPresenceClient({
      wsBaseUrl: opts.wsBaseUrl,
      classId: opts.classId,
      sessionId: opts.sessionId,
      token: opts.token,
      userId: opts.userId,
      role: opts.role,
    })

    c.on('message', (m) => handleServerMessage(m))
    c.on('open', () => {
      state.value = 'connected'
      backoffMs.value = 1000
    })
    c.on('close', (ev) => {
      state.value = 'disconnected'

      const code = ev.code
      if (code === 4403) {
        notifyError('Немає доступу')
        followTeacherEnabled.value = false
        reconnectAbort = true
        return
      }

      if (code === 4401) {
        notifyWarning('Сесія доступу завершилась. Оновіть сторінку')
      }

      // 4400/4429/1011 → backoff reconnect
      if (!reconnectAbort) {
        void scheduleReconnect(opts)
      }
    })

    client.value = c
    c.connect()
  }

  function disconnect(): void {
    reconnectAbort = true
    state.value = 'disconnected'
    client.value?.disconnect()
    client.value = null
  }

  async function scheduleReconnect(opts: {
    wsBaseUrl: string
    classId: string
    sessionId: string
    token: string
    userId: string
    role: ClassroomWsRole
  }): Promise<void> {
    if (reconnectAbort) return
    state.value = 'reconnecting'

    const delay = jitter(backoffMs.value)
    await sleep(delay)
    if (reconnectAbort) return

    backoffMs.value = Math.min(MAX_BACKOFF_MS, backoffMs.value * 2)

    try {
      client.value?.disconnect()
    } catch {
      // ignore
    }

    // recreate client to ensure clean state
    await connect(opts)
  }

  function sendCursor(x: number, y: number, tool: string, color: string): void {
    const now = performance.now()
    if (now - lastCursorSentAt.value < MIN_CURSOR_INTERVAL_MS) return
    lastCursorSentAt.value = now

    // Contract policy: throttle+drop (do not queue)
    client.value?.sendCursorUpdate({ x, y, tool, color })
  }

  return {
    state,
    cursorsList,
    teacherCursor,
    presentUsers,
    followTeacherEnabled,
    teacherUserId,
    setFollowTeacher,
    initTeacher,
    connect,
    disconnect,
    sendCursor,
  }
})
