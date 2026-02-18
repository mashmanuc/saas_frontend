// WB: useCollaboration — Yjs CRDT collaboration composable
// Ref: TASK_BOARD_PHASES.md A6.1, LAW-16 (Multi-User), LAW-02 (Sync)
//
// Responsibilities:
// 1. Create Yjs document
// 2. Connect WebSocket provider (y-websocket)
// 3. Connect IndexedDB provider (offline persistence)
// 4. Setup bidirectional sync with boardStore
// 5. Expose connection state, peers, doc
//
// Feature flag: WB_USE_YJS — when false, this composable is a no-op

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import * as Y from 'yjs'
import { createWBDocument, setMeta } from '../engine/collaboration/yjsDocument'
import { setupYjsSync, type YjsSyncHandle, type WBStoreAdapter } from '../engine/collaboration/yjsSync'
import { useWBStore } from '../board/state/boardStore'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:Collab]'

// ─── Feature flag ───────────────────────────────────────────────────────────

// A7.2: Delegate to centralized feature flag system
import { isWinterboardYjsEnabled } from '../config/featureFlags'

/**
 * Check if Yjs collaboration is enabled.
 * Delegates to centralized feature flag system (config/featureFlags.ts).
 */
export function isYjsEnabled(): boolean {
  return isWinterboardYjsEnabled()
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CollabPeer {
  userId: string
  displayName: string
  color: string
  isOnline: boolean
}

export interface UseCollaborationReturn {
  /** Yjs document instance (null if Yjs disabled) */
  doc: Y.Doc | null
  /** Whether WebSocket is connected */
  isConnected: Ref<boolean>
  /** Whether initial sync is complete */
  isSynced: Ref<boolean>
  /** Connected peers */
  peers: Ref<CollabPeer[]>
  /** Connection error message */
  connectionError: Ref<string | null>
  /** Whether Yjs collaboration is active */
  isCollaborative: Ref<boolean>
  /** Yjs sync handle for store interceptors */
  syncHandle: YjsSyncHandle | null
  /** Awareness instance (for useYjsPresence) */
  awareness: unknown | null
  /** Manual connect */
  connect: () => void
  /** Manual disconnect */
  disconnect: () => void
}

// ─── Provider interfaces ────────────────────────────────────────────────────
// Lazy-loaded to avoid bundling y-websocket/y-indexeddb when Yjs is disabled

interface WsProviderLike {
  awareness: unknown
  connected: boolean
  synced: boolean
  on(event: string, cb: (...args: unknown[]) => void): void
  off(event: string, cb: (...args: unknown[]) => void): void
  destroy(): void
  connect(): void
  disconnect(): void
}

interface IdbProviderLike {
  synced: boolean
  on(event: string, cb: (...args: unknown[]) => void): void
  destroy(): void
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useCollaboration(
  sessionId: Ref<string>,
  userId: string,
  opts?: {
    displayName?: string
    color?: string
    wsUrl?: string
    token?: string
  },
): UseCollaborationReturn {
  // ── Early exit if Yjs disabled ────────────────────────────────────────

  const isCollaborative = ref(isYjsEnabled())

  if (!isCollaborative.value) {
    console.info(LOG, 'Yjs disabled — using REST save flow')
    return {
      doc: null,
      isConnected: ref(false),
      isSynced: ref(false),
      peers: ref([]),
      connectionError: ref(null),
      isCollaborative,
      syncHandle: null,
      awareness: null,
      connect: () => {},
      disconnect: () => {},
    }
  }

  // ── Yjs document ──────────────────────────────────────────────────────

  const doc = createWBDocument()
  const isConnected = ref(false)
  const isSynced = ref(false)
  const peers = ref<CollabPeer[]>([])
  const connectionError = ref<string | null>(null)

  let wsProvider: WsProviderLike | null = null
  let idbProvider: IdbProviderLike | null = null
  let syncHandle: YjsSyncHandle | null = null

  // ── Resolve WebSocket URL ─────────────────────────────────────────────

  function resolveWsUrl(): string {
    if (opts?.wsUrl) return opts.wsUrl
    if (typeof window === 'undefined') return 'ws://localhost:1234'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env?.VITE_YJS_WS_HOST || window.location.host
    return `${protocol}//${host}/yjs`
  }

  // ── Connect ───────────────────────────────────────────────────────────

  async function connect(): Promise<void> {
    if (wsProvider) return // already connected

    const sid = sessionId.value
    if (!sid) {
      console.warn(LOG, 'Cannot connect: no sessionId')
      return
    }

    console.info(LOG, 'Connecting...', { sessionId: sid, userId })

    try {
      // 1. IndexedDB provider (offline persistence)
      const { IndexeddbPersistence } = await import('y-indexeddb')
      idbProvider = new IndexeddbPersistence(`wb-${sid}`, doc) as unknown as IdbProviderLike
      idbProvider.on('synced', () => {
        console.info(LOG, 'IndexedDB synced')
      })

      // 2. WebSocket provider
      const { WebsocketProvider } = await import('y-websocket')
      const wsUrl = resolveWsUrl()
      const params: Record<string, string> = {}
      if (opts?.token) params.token = opts.token

      wsProvider = new WebsocketProvider(wsUrl, sid, doc, {
        params,
        connect: true,
        resyncInterval: 30_000, // Re-sync every 30s
        maxBackoffTime: 10_000, // Max reconnect backoff
      }) as unknown as WsProviderLike

      // 3. Track connection state
      wsProvider.on('status', (event: unknown) => {
        const status = (event as { status: string }).status
        isConnected.value = status === 'connected'
        if (status === 'connected') {
          connectionError.value = null
          console.info(LOG, 'WebSocket connected')
        } else if (status === 'disconnected') {
          console.info(LOG, 'WebSocket disconnected')
        }
      })

      wsProvider.on('sync', (synced: unknown) => {
        isSynced.value = synced as boolean
        if (synced) {
          console.info(LOG, 'WebSocket synced')
        }
      })

      wsProvider.on('connection-error', (err: unknown) => {
        connectionError.value = 'WebSocket connection failed'
        console.error(LOG, 'Connection error:', err)
      })

      // 4. Setup meta
      setMeta(doc, { sessionId: sid, name: '', rev: 0 })

      // 5. Setup bidirectional sync with boardStore
      const store = useWBStore() as unknown as WBStoreAdapter
      syncHandle = setupYjsSync(doc, store, userId)

      // 6. Mark store as collaborative
      const pStore = useWBStore()
      pStore.isCollaborative = true

    } catch (err) {
      connectionError.value = err instanceof Error ? err.message : 'Failed to initialize collaboration'
      console.error(LOG, 'Init failed:', err)
    }
  }

  // ── Disconnect ────────────────────────────────────────────────────────

  function disconnect(): void {
    syncHandle?.destroy()
    syncHandle = null

    wsProvider?.destroy()
    wsProvider = null

    idbProvider?.destroy()
    idbProvider = null

    isConnected.value = false
    isSynced.value = false
    peers.value = []

    console.info(LOG, 'Disconnected')
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onMounted(() => {
    if (isCollaborative.value) {
      connect()
    }
  })

  onUnmounted(() => {
    disconnect()
    doc.destroy()
  })

  return {
    doc,
    isConnected,
    isSynced,
    peers,
    connectionError,
    isCollaborative,
    get syncHandle() { return syncHandle },
    get awareness() { return wsProvider?.awareness ?? null },
    connect,
    disconnect,
  }
}
