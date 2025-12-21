export type ClassroomWsRole = 'teacher' | 'student' | 'observer'

export type WsCloseCode = 4400 | 4401 | 4403 | 4429 | 1011

export type PresenceJoinMsg = {
  type: 'presence.join'
  userId: string
  role: ClassroomWsRole
  ts: number
}

export type PresenceLeaveMsg = {
  type: 'presence.leave'
  userId: string
  ts: number
}

export type PresenceHeartbeatMsg = {
  type: 'presence.heartbeat'
  userId: string
  ts: number
}

export type CursorUpdateMsg = {
  type: 'cursor.update'
  userId: string
  x: number
  y: number
  tool: string
  color: string
  ts: number
}

export type ServerAckMsg = {
  type: 'ack'
  ok: boolean
  for: string
}

export type ServerErrorMsg = {
  type: 'error'
  code:
    | 'payload_too_large'
    | 'rate_limited'
    | 'invalid_message'
    | 'unauthorized'
    | 'forbidden'
  message?: string
  retry_after_seconds?: number
}

export type ServerToClientMsg =
  | PresenceJoinMsg
  | PresenceLeaveMsg
  | CursorUpdateMsg
  | ServerAckMsg
  | ServerErrorMsg

export interface ClassroomPresenceClientOptions {
  wsBaseUrl: string
  classId: string
  sessionId: string
  token: string
  userId: string
  role: ClassroomWsRole
  heartbeatMs?: number
  maxPayloadBytes?: number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

export type ClassroomPresenceClientEvents = {
  message: (msg: ServerToClientMsg) => void
  open: () => void
  close: (ev: CloseEvent) => void
  error: (ev: Event) => void
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function approxUtf8Bytes(s: string): number {
  try {
    return new TextEncoder().encode(s).byteLength
  } catch {
    return s.length
  }
}

export class ClassroomPresenceClient {
  private socket: WebSocket | null = null
  private opts: Required<
    Pick<ClassroomPresenceClientOptions, 'heartbeatMs' | 'maxPayloadBytes' | 'logger'>
  > &
    Omit<ClassroomPresenceClientOptions, 'heartbeatMs' | 'maxPayloadBytes' | 'logger'>

  private listeners = {
    message: new Set<ClassroomPresenceClientEvents['message']>(),
    open: new Set<ClassroomPresenceClientEvents['open']>(),
    close: new Set<ClassroomPresenceClientEvents['close']>(),
    error: new Set<ClassroomPresenceClientEvents['error']>(),
  }

  private heartbeatTimer: number | null = null

  constructor(options: ClassroomPresenceClientOptions) {
    this.opts = {
      heartbeatMs: options.heartbeatMs ?? 15_000,
      maxPayloadBytes: options.maxPayloadBytes ?? 2048,
      logger: options.logger ?? console,
      ...options,
    }
  }

  on<K extends keyof ClassroomPresenceClientEvents>(event: K, cb: ClassroomPresenceClientEvents[K]): () => void {
    const set = this.listeners[event] as Set<ClassroomPresenceClientEvents[K]>
    set.add(cb)
    return () => {
      set.delete(cb)
    }
  }

  private emit(event: 'open'): void
  private emit(event: 'message', payload: ServerToClientMsg): void
  private emit(event: 'close', payload: CloseEvent): void
  private emit(event: 'error', payload: Event): void
  private emit(event: keyof ClassroomPresenceClientEvents, payload?: unknown): void {
    const set = this.listeners[event] as Set<(arg?: unknown) => void>
    set.forEach((cb) => {
      try {
        cb(payload)
      } catch (e) {
        this.opts.logger.error('[classroom.ws][listener]', e)
      }
    })
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    const base = this.opts.wsBaseUrl.replace(/\/$/, '')
    const url = `${base}/classroom/${encodeURIComponent(this.opts.classId)}/session/${encodeURIComponent(this.opts.sessionId)}`

    // Contract: Sec-WebSocket-Protocol: access_token, <JWT>
    this.socket = new WebSocket(url, ['access_token', this.opts.token])

    this.socket.addEventListener('open', () => {
      this.emit('open')
      this.send({
        type: 'presence.join',
        userId: this.opts.userId,
        role: this.opts.role,
        ts: Date.now(),
      })
      this.startHeartbeat()
    })

    this.socket.addEventListener('message', (ev) => {
      if (typeof ev.data !== 'string') return
      const parsed = safeJsonParse(ev.data)
      if (!parsed || typeof parsed !== 'object') return
      const msg = parsed as ServerToClientMsg
      this.emit('message', msg)
    })

    this.socket.addEventListener('close', (ev) => {
      this.stopHeartbeat()
      this.emit('close', ev)
    })

    this.socket.addEventListener('error', (ev) => {
      this.emit('error', ev)
    })
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({ type: 'presence.leave', userId: this.opts.userId, ts: Date.now() })
    }
    this.socket?.close()
    this.socket = null
  }

  send(msg: PresenceJoinMsg | PresenceLeaveMsg | PresenceHeartbeatMsg | CursorUpdateMsg): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return

    // Contract: payload <= 2048 bytes
    const raw = JSON.stringify(msg)
    if (approxUtf8Bytes(raw) > this.opts.maxPayloadBytes) {
      this.opts.logger.warn('[classroom.ws] payload too large, dropping', msg.type)
      return
    }

    this.socket.send(raw)
  }

  sendCursorUpdate(patch: Omit<CursorUpdateMsg, 'type' | 'userId' | 'ts'> & { ts?: number }): void {
    this.send({
      type: 'cursor.update',
      userId: this.opts.userId,
      ts: patch.ts ?? Date.now(),
      x: patch.x,
      y: patch.y,
      tool: patch.tool,
      color: patch.color,
    })
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      this.send({
        type: 'presence.heartbeat',
        userId: this.opts.userId,
        ts: Date.now(),
      })
    }, this.opts.heartbeatMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
