/**
 * Whiteboard Store for Classroom
 * v0.83.0 - Pages management with adapters and paywall support
 * v0.85.0 - Recovery state with snapshot and pending operations
 * v0.88.0 - Follow-mode support (presenter page tracking)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StorageAdapter, PolicyAdapter, PageMetadata, PageData } from '@/core/whiteboard/adapters'
import type { 
  RealtimeAdapter, 
  PresenceUser, 
  RemoteCursor, 
  BoardOperation,
  WhiteboardOperation,
  OpsAckPayload,
  ResyncResponse,
  PresenterPageChangedPayload
} from '@/core/whiteboard/adapters/RealtimeAdapter'
import { M4shStorageAdapter, M4shPolicyAdapter } from '../adapters'
import { NoopRealtimeAdapter } from '@/core/whiteboard/adapters/NoopRealtimeAdapter'
import { DevWhiteboardStorageAdapter } from '@/core/whiteboard/adapters/DevWhiteboardStorageAdapter'
import { normalizePageState } from '@/core/whiteboard/utils/normalizePageState'

export type WhiteboardStatus = 'idle' | 'loading' | 'saving' | 'error'
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export const useWhiteboardStore = defineStore('whiteboard', () => {
  // Adapters
  const storageAdapter = ref<StorageAdapter>(new M4shStorageAdapter())
  const policyAdapter = ref<PolicyAdapter>(new M4shPolicyAdapter())
  const realtimeAdapter = ref<RealtimeAdapter>(new NoopRealtimeAdapter())

  // State
  const workspaceId = ref<string | null>(null)
  const pages = ref<PageMetadata[]>([])
  const activePageId = ref<string | null>(null)
  const currentPageData = ref<PageData | null>(null)
  const status = ref<WhiteboardStatus>('idle')
  const error = ref<string | null>(null)

  // Limits
  const limits = ref<{ maxPages: number | null }>({ maxPages: null })
  
  // Paywall
  const showPaywallModal = ref(false)
  const paywallData = ref<any>(null)

  // Realtime
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const presenceUsers = ref<PresenceUser[]>([])
  const remoteCursors = ref<Map<string, RemoteCursor>>(new Map())

  // Recovery state (v0.85.0)
  const currentVersion = ref<number>(1)
  const lastAckedVersion = ref<number>(1)
  const pendingOps = ref<Map<string, WhiteboardOperation>>(new Map())
  const isRecovering = ref<boolean>(false)

  // Role & Moderation state (v0.86.0)
  const myRole = ref<'viewer' | 'editor' | 'moderator'>('viewer')
  const isBoardFrozen = ref<boolean>(false)
  const presenterUserId = ref<string | null>(null)
  const followPresenterEnabled = ref<boolean>(false)
  
  // v0.88.0: Follow-mode state
  const presenterPageId = ref<string | null>(null)
  const isFollowModeActive = ref<boolean>(false)

  // v0.87.0: SafeMode state
  const safeMode = ref<boolean>(false)
  const MAX_PENDING_OPS = 300

  // v0.93.0: Dev workspace - page states map (per-page strokes/assets)
  const pageStates = ref<Map<string, PageData['state']>>(new Map())

  // Computed
  const activePage = computed(() => pages.value.find(p => p.id === activePageId.value) || null)
  const pageCount = computed(() => pages.value.length)
  const canCreatePage = computed(() => {
    if (limits.value.maxPages === null) return true
    return pageCount.value < limits.value.maxPages
  })
  
  // v0.86.0: Computed permissions
  const canEdit = computed(() => {
    if (isBoardFrozen.value) return false
    if (safeMode.value) return false  // v0.87.0: SafeMode blocks editing
    return myRole.value === 'editor' || myRole.value === 'moderator'
  })
  
  const canModerate = computed(() => myRole.value === 'moderator')

  /**
   * Bootstrap whiteboard for workspace
   * v0.92.0: Dev workspace support with placeholder pages
   */
  async function bootstrap(wsId: string): Promise<void> {
    workspaceId.value = wsId
    status.value = 'loading'
    error.value = null

    try {
      // v0.93.0: Dev workspace branch (localStorage persistence, 10 pages)
      if (wsId.startsWith('dev-workspace-')) {
        console.log('[WhiteboardStore] Bootstrapping dev workspace:', wsId)
        
        // v0.93.0: Use DevWhiteboardStorageAdapter for dev workspaces
        storageAdapter.value = new DevWhiteboardStorageAdapter()
        
        // Create 10 pages for dev vertical layout (LAW-03: Pages = Ordered Stack)
        const placeholderPages: PageMetadata[] = []
        for (let i = 0; i < 10; i++) {
          placeholderPages.push({
            id: `${wsId}-page-${i + 1}`,
            title: `Page ${i + 1}`,
            index: i,
            version: 1,
            updatedAt: new Date().toISOString(),
          })
        }
        
        pages.value = placeholderPages
        activePageId.value = placeholderPages[0].id
        
        // v0.93.0: Load page states from localStorage (LAW-02: Persistency)
        // Initialize pageStates map for all pages
        for (const page of placeholderPages) {
          try {
            const pageData = await storageAdapter.value.loadPage(page.id)
            // P0.1: Normalize state after load to ensure invariants
            const { state: normalizedState, stats } = normalizePageState(pageData.state, { warnOnce: true })
            pageStates.value.set(page.id, normalizedState)
            if (stats.droppedStrokes > 0 || stats.fixedStrokes > 0) {
              console.log('[WhiteboardStore] Normalized page state on load', { pageId: page.id, stats })
            }
          } catch (err) {
            console.warn('[WhiteboardStore] Failed to load page state, using empty', { pageId: page.id, err })
            pageStates.value.set(page.id, { strokes: [], assets: [] })
          }
        }
        
        // Set current page data from loaded state
        const firstPageState = pageStates.value.get(placeholderPages[0].id) || { strokes: [], assets: [] }
        currentPageData.value = {
          id: placeholderPages[0].id,
          title: placeholderPages[0].title,
          index: placeholderPages[0].index,
          version: 1,
          state: firstPageState,
          updatedAt: new Date().toISOString(),
        }
        
        // Dev mode: no limits, full permissions
        limits.value = { maxPages: null }
        myRole.value = 'moderator'
        isBoardFrozen.value = false
        
        status.value = 'idle'
        console.log('[WhiteboardStore] Dev workspace ready with', placeholderPages.length, 'pages')
        return
      }

      // Production branch: normal flow
      // v0.86.0: Load workspace state (role, frozen, presenter)
      await loadWorkspaceState()

      // Load limits
      const fetchedLimits = await policyAdapter.value.getLimits(wsId)
      limits.value = fetchedLimits

      // Load pages
      const fetchedPages = await storageAdapter.value.listPages(wsId)
      pages.value = fetchedPages.sort((a, b) => a.index - b.index)

      // Set active page to first or create one if empty
      if (pages.value.length === 0) {
        await createPage()
      } else {
        activePageId.value = pages.value[0].id
        await loadActivePage()
      }

      status.value = 'idle'
    } catch (err: any) {
      console.error('[WhiteboardStore] Bootstrap failed:', err)
      error.value = err.message || 'Failed to initialize whiteboard'
      status.value = 'error'
      throw err
    }
  }

  /**
   * Create new page
   * v0.83.0: Handle 409 limit_exceeded with paywall
   */
  async function createPage(title?: string): Promise<PageData> {
    if (!workspaceId.value) {
      throw new Error('Workspace not initialized')
    }

    // Soft check for UX optimization
    if (!canCreatePage.value) {
      showPaywall({ 
        limit_type: 'whiteboard_pages_per_workspace',
        limit: limits.value.maxPages,
        current: pageCount.value,
        required_plan: 'pro'
      })
      throw new Error('PAGE_LIMIT_EXCEEDED')
    }

    status.value = 'loading'
    error.value = null

    try {
      const newPage = await storageAdapter.value.createPage(workspaceId.value, { title })
      
      // Add to pages list
      pages.value.push({
        id: newPage.id,
        title: newPage.title,
        index: newPage.index,
        version: newPage.version,
        updatedAt: newPage.updatedAt,
      })

      // Sort by index
      pages.value.sort((a, b) => a.index - b.index)

      // Switch to new page
      await switchToPage(newPage.id)

      status.value = 'idle'
      return newPage
    } catch (err: any) {
      // Handle 409 limit_exceeded from backend
      if (err.message === 'PAGE_LIMIT_EXCEEDED' && err.limitData) {
        showPaywall(err.limitData)
      }
      
      console.error('[WhiteboardStore] Create page failed:', err)
      error.value = err.message || 'Failed to create page'
      status.value = 'error'
      throw err
    }
  }

  /**
   * Show paywall modal
   */
  function showPaywall(limitData: any): void {
    paywallData.value = limitData
    showPaywallModal.value = true
  }

  /**
   * Close paywall modal
   */
  function closePaywall(): void {
    showPaywallModal.value = false
    paywallData.value = null
  }

  /**
   * Switch to page
   */
  async function switchToPage(pageId: string): Promise<void> {
    if (activePageId.value === pageId) return

    status.value = 'loading'
    error.value = null

    try {
      activePageId.value = pageId
      await loadActivePage()
      status.value = 'idle'
    } catch (err: any) {
      console.error('[WhiteboardStore] Switch page failed:', err)
      error.value = err.message || 'Failed to switch page'
      status.value = 'error'
      throw err
    }
  }

  /**
   * v0.93.0: Set active page by scroll (LAW-04)
   * Called from PageVerticalStack IntersectionObserver
   * v0.93.1: Додано debounce для зменшення flood логів
   */
  let activePageDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const ACTIVE_PAGE_DEBOUNCE_MS = 300

  function setActivePageByScroll(pageId: string): void {
    if (activePageId.value === pageId) return

    // v0.93.1: Debounce logging to prevent flood
    if (activePageDebounceTimer) {
      clearTimeout(activePageDebounceTimer)
    }
    
    activePageDebounceTimer = setTimeout(() => {
      if (import.meta.env.DEV) {
        console.info('[WhiteboardStore] Active page changed by scroll', { pageId })
      }
    }, ACTIVE_PAGE_DEBOUNCE_MS)

    activePageId.value = pageId

    // Load page data for dev workspace
    if (workspaceId.value?.startsWith('dev-workspace-')) {
      const page = pages.value.find(p => p.id === pageId)
      if (page) {
        const pageState = pageStates.value.get(pageId) || { strokes: [], assets: [] }
        currentPageData.value = {
          id: page.id,
          title: page.title,
          index: page.index,
          version: 1,
          state: pageState,
          updatedAt: new Date().toISOString(),
        }
      }
    }
  }

  /**
   * Load active page data
   */
  async function loadActivePage(): Promise<void> {
    if (!activePageId.value) return

    try {
      // v0.93.0: For dev workspace, use pageStates map
      if (workspaceId.value?.startsWith('dev-workspace-')) {
        const pageState = pageStates.value.get(activePageId.value) || { strokes: [], assets: [] }
        const page = pages.value.find(p => p.id === activePageId.value)
        if (page) {
          currentPageData.value = {
            id: page.id,
            title: page.title,
            index: page.index,
            version: 1,
            state: pageState,
            updatedAt: new Date().toISOString(),
          }
        }
      } else {
        const pageData = await storageAdapter.value.loadPage(activePageId.value)
        currentPageData.value = pageData
      }
    } catch (err: any) {
      console.error('[WhiteboardStore] Load page failed:', err)
      throw err
    }
  }

  /**
   * Save current page
   */
  async function savePage(state: PageData['state']): Promise<void> {
    if (!activePageId.value || !currentPageData.value) {
      throw new Error('No active page to save')
    }

    status.value = 'saving'
    error.value = null

    try {
      const result = await storageAdapter.value.savePage(activePageId.value, {
        state,
        version: currentPageData.value.version,
      })

      // Update version
      currentPageData.value.version = result.version
      currentPageData.value.state = state

      // v0.93.0: Update pageStates map for dev workspace
      if (workspaceId.value?.startsWith('dev-workspace-')) {
        pageStates.value.set(activePageId.value, state)
      }

      // Update metadata in pages list
      const pageIndex = pages.value.findIndex(p => p.id === activePageId.value)
      if (pageIndex !== -1) {
        pages.value[pageIndex].version = result.version
        pages.value[pageIndex].updatedAt = new Date().toISOString()
      }

      status.value = 'idle'
    } catch (err: any) {
      console.error('[WhiteboardStore] Save page failed:', err)
      error.value = err.message || 'Failed to save page'
      status.value = 'error'
      throw err
    }
  }

  /**
   * v0.93.0: Update page state (for autosave)
   * Used by PageVerticalStack to save individual page changes
   */
  async function updatePageState(pageId: string, state: PageData['state']): Promise<void> {
    if (!workspaceId.value) {
      throw new Error('Workspace not initialized')
    }

    try {
      // P0.1: Normalize state before save to ensure invariants
      const { state: normalizedState, stats } = normalizePageState(state)
      
      if (stats.droppedStrokes > 0 || stats.fixedStrokes > 0) {
        console.warn('[WhiteboardStore] State normalized before save', { pageId, stats })
      }

      // Save to localStorage via adapter
      await storageAdapter.value.savePage(pageId, { state: normalizedState, version: 1 })

      // Update pageStates map
      pageStates.value.set(pageId, normalizedState)

      // If this is active page, update currentPageData
      if (activePageId.value === pageId && currentPageData.value) {
        currentPageData.value.state = normalizedState
        currentPageData.value.updatedAt = new Date().toISOString()
      }

      console.info('[WhiteboardStore] Page state updated', { pageId, strokesCount: normalizedState.strokes.length })
    } catch (err: any) {
      console.error('[WhiteboardStore] Update page state failed:', err)
      throw err
    }
  }

  /**
   * v0.93.0: Add dev page (LAW-03, 2.7)
   * Dev-only method to add new page
   */
  function addDevPage(): void {
    if (!workspaceId.value?.startsWith('dev-workspace-')) {
      console.error('[WhiteboardStore] addDevPage called for non-dev workspace')
      return
    }

    // Check limits
    if (!canCreatePage.value) {
      console.warn('[WhiteboardStore] Cannot add page: limit reached', { 
        current: pageCount.value, 
        max: limits.value.maxPages 
      })
      // Emit event or show toast (handled by UI)
      return
    }

    const newIndex = pages.value.length
    const newPageId = `${workspaceId.value}-page-${newIndex + 1}`

    const newPage: PageMetadata = {
      id: newPageId,
      title: `Page ${newIndex + 1}`,
      index: newIndex,
      version: 1,
      updatedAt: new Date().toISOString(),
    }

    pages.value.push(newPage)
    pageStates.value.set(newPageId, { strokes: [], assets: [] })

    console.info('[WhiteboardStore] Dev page added', { pageId: newPageId, totalPages: pages.value.length })
  }

  /**
   * Delete page
   */
  async function deletePage(pageId: string): Promise<void> {
    if (pages.value.length <= 1) {
      throw new Error('Cannot delete last page')
    }

    const pageIndex = pages.value.findIndex(p => p.id === pageId)
    if (pageIndex === -1) return

    // Switch to another page if deleting active
    if (activePageId.value === pageId) {
      const nextPage = pages.value[pageIndex + 1] || pages.value[pageIndex - 1]
      if (nextPage) {
        await switchToPage(nextPage.id)
      }
    }

    // Remove from list
    pages.value.splice(pageIndex, 1)
  }

  /**
   * Rename page
   */
  function renamePage(pageId: string, title: string): void {
    const page = pages.value.find(p => p.id === pageId)
    if (page) {
      page.title = title
    }
  }

  /**
   * Set realtime adapter
   */
  function setRealtimeAdapter(adapter: RealtimeAdapter): void {
    realtimeAdapter.value = adapter
  }

  /**
   * Connect to realtime session
   */
  async function connectRealtime(userId: string): Promise<void> {
    if (!workspaceId.value) {
      throw new Error('Workspace not initialized')
    }

    connectionStatus.value = 'connecting'

    try {
      await realtimeAdapter.value.connect(workspaceId.value, userId)
      connectionStatus.value = 'connected'

      // Subscribe to events
      realtimeAdapter.value.onPresenceChange((users) => {
        presenceUsers.value = users
      })

      realtimeAdapter.value.onCursorMove((cursor) => {
        remoteCursors.value.set(cursor.userId, cursor)
        
        // Clean up old cursors (>5 seconds)
        const now = Date.now()
        remoteCursors.value.forEach((c, userId) => {
          if (now - c.timestamp > 5000) {
            remoteCursors.value.delete(userId)
          }
        })
      })

      realtimeAdapter.value.onOperation((op) => {
        handleRemoteOperation(op)
      })

      realtimeAdapter.value.onPageSwitch((pageId, userId) => {
        console.log(`[WhiteboardStore] User ${userId} switched to page ${pageId}`)
      })

      // v0.85.0: Subscribe to ops_ack and resync
      if (realtimeAdapter.value.onOpsAck) {
        realtimeAdapter.value.onOpsAck((payload) => {
          markOpsAcked(payload.opIds, payload.appliedVersion)
        })
      }

      if (realtimeAdapter.value.onResync) {
        realtimeAdapter.value.onResync((payload) => {
          handleResyncResponse(payload)
        })
      }

      // v0.86.0: Subscribe to moderation events
      const adapter = realtimeAdapter.value as any
      if (adapter.onBoardFrozen) {
        adapter.onBoardFrozen((frozen: boolean) => {
          handleBoardFrozen(frozen)
        })
      }

      if (adapter.onPresenterChanged) {
        adapter.onPresenterChanged((userId: string | null) => {
          handlePresenterChanged(userId)
        })
      }
      
      // v0.88.0: Subscribe to presenter page changed
      if (adapter.onPresenterPageChanged) {
        adapter.onPresenterPageChanged((payload: PresenterPageChangedPayload) => {
          handlePresenterPageChanged(payload)
        })
      }

      // Listen for version conflicts
      window.addEventListener('whiteboard:version-conflict', handleVersionConflict as EventListener)
    } catch (err: any) {
      console.error('[WhiteboardStore] Realtime connection failed:', err)
      connectionStatus.value = 'error'
      throw err
    }
  }

  /**
   * Disconnect from realtime session
   */
  function disconnectRealtime(): void {
    realtimeAdapter.value.disconnect()
    connectionStatus.value = 'disconnected'
    presenceUsers.value = []
    remoteCursors.value.clear()
    window.removeEventListener('whiteboard:version-conflict', handleVersionConflict as EventListener)
  }

  /**
   * Send cursor position
   */
  function sendCursorMove(x: number, y: number, tool: string, color: string): void {
    realtimeAdapter.value.sendCursorMove(x, y, tool, color)
  }

  /**
   * Send board operation
   */
  async function sendOperation(op: BoardOperation): Promise<void> {
    await realtimeAdapter.value.sendOperation(op)
  }

  /**
   * Handle remote operation
   */
  function handleRemoteOperation(op: BoardOperation): void {
    console.log('[WhiteboardStore] Remote operation received:', op)
    // Update current page data if operation is for active page
    if (op.pageId === activePageId.value && currentPageData.value) {
      // Apply operation to local state (implementation depends on whiteboard engine)
      // For now, just update version
      currentPageData.value.version = op.version
    }
  }

  /**
   * Queue operation for sending (v0.85.0)
   */
  function queueOperation(op: BoardOperation): void {
    if (!activePageId.value) return

    const opId = crypto.randomUUID()
    const whiteboardOp: WhiteboardOperation = {
      op_id: opId,
      pageId: activePageId.value,
      baseVersion: currentVersion.value,
      payload: op
    }

    pendingOps.value.set(opId, whiteboardOp)
    currentVersion.value++

    // Send via adapter if available
    if (realtimeAdapter.value.sendOperations) {
      realtimeAdapter.value.sendOperations([whiteboardOp])
    }
  }

  /**
   * Mark operations as acknowledged (v0.85.0)
   */
  function markOpsAcked(opIds: string[], appliedVersion: number): void {
    opIds.forEach(opId => {
      pendingOps.value.delete(opId)
    })

    lastAckedVersion.value = appliedVersion
    console.log(`[WhiteboardStore] Acknowledged ${opIds.length} operations, version ${appliedVersion}`)
  }

  /**
   * Apply snapshot from resync (v0.85.0)
   */
  function applySnapshot(snapshot: { version: number; state: unknown }): void {
    if (!currentPageData.value) return

    currentPageData.value.state = snapshot.state as any
    currentPageData.value.version = snapshot.version
    currentVersion.value = snapshot.version
    lastAckedVersion.value = snapshot.version

    console.log(`[WhiteboardStore] Applied snapshot at version ${snapshot.version}`)
  }

  /**
   * Apply replay operations after snapshot (v0.85.0)
   */
  function applyReplayOperations(ops: Array<{ op_id: string; payload: BoardOperation; appliedVersion: number }>): void {
    ops.forEach(op => {
      handleRemoteOperation(op.payload)
      currentVersion.value = op.appliedVersion
    })

    console.log(`[WhiteboardStore] Replayed ${ops.length} operations`)
  }

  /**
   * Handle resync response (v0.85.0)
   */
  async function handleResyncResponse(payload: ResyncResponse): Promise<void> {
    if (payload.pageId !== activePageId.value) return

    isRecovering.value = true

    try {
      // Apply snapshot
      applySnapshot(payload.snapshot)

      // Apply operations since snapshot
      applyReplayOperations(payload.operations)

      // Clear pending ops for this page
      pendingOps.value.forEach((op, opId) => {
        if (op.pageId === payload.pageId) {
          pendingOps.value.delete(opId)
        }
      })

      console.log(`[WhiteboardStore] Resync completed for page ${payload.pageId}`)
    } finally {
      isRecovering.value = false
    }
  }

  /**
   * Handle version conflict
   */
  async function handleVersionConflict(event: CustomEvent): Promise<void> {
    const { pageId, currentVersion: serverVersion } = event.detail
    console.warn('[WhiteboardStore] Version conflict, requesting resync', { pageId, serverVersion })
    
    if (pageId === activePageId.value && realtimeAdapter.value.requestResync) {
      await realtimeAdapter.value.requestResync({
        pageId,
        lastKnownVersion: lastAckedVersion.value
      })
    }
  }

  /**
   * Handle board frozen/unfrozen (v0.86.0)
   */
  function handleBoardFrozen(frozen: boolean): void {
    isBoardFrozen.value = frozen
    console.log(`[WhiteboardStore] Board ${frozen ? 'frozen' : 'unfrozen'}`)
  }

  /**
   * Handle presenter changed (v0.86.0)
   */
  function handlePresenterChanged(userId: string | null): void {
    presenterUserId.value = userId
    console.log(`[WhiteboardStore] Presenter changed to ${userId}`)
  }

  /**
   * Toggle follow presenter mode (v0.86.0)
   */
  function toggleFollowPresenter(): void {
    followPresenterEnabled.value = !followPresenterEnabled.value
    console.log(`[WhiteboardStore] Follow presenter ${followPresenterEnabled.value ? 'enabled' : 'disabled'}`)
  }

  /**
   * Send freeze/unfreeze command (v0.86.0)
   */
  async function sendFreeze(frozen: boolean): Promise<void> {
    if (!canModerate.value) {
      console.warn('[WhiteboardStore] Cannot freeze: not a moderator')
      return
    }

    const adapter = realtimeAdapter.value as any
    if (adapter.sendFreeze) {
      await adapter.sendFreeze(frozen)
    }
  }

  /**
   * Send clear page command (v0.86.0)
   */
  async function sendClearPage(pageId: string): Promise<void> {
    if (!canModerate.value) {
      console.warn('[WhiteboardStore] Cannot clear page: not a moderator')
      return
    }

    const adapter = realtimeAdapter.value as any
    if (adapter.sendClearPage) {
      await adapter.sendClearPage(pageId)
    }
  }

  /**
   * Send set presenter command (v0.86.0)
   */
  async function sendSetPresenter(userId: string | null): Promise<void> {
    if (!canModerate.value) {
      console.warn('[WhiteboardStore] Cannot set presenter: not a moderator')
      return
    }

    const adapter = realtimeAdapter.value as any
    if (adapter.sendSetPresenter) {
      await adapter.sendSetPresenter(userId)
    }
  }

  /**
   * Load workspace state from API (v0.86.0, extended v0.88.0)
   */
  async function loadWorkspaceState(): Promise<void> {
    if (!workspaceId.value) return

    try {
      const response = await fetch(`/api/v1/whiteboard/workspaces/${workspaceId.value}/state/`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to load workspace state: ${response.status}`)
      }

      const data = await response.json()
      
      myRole.value = data.myRole || 'viewer'
      isBoardFrozen.value = data.isFrozen || false
      presenterUserId.value = data.presenterUserId || null
      presenterPageId.value = data.presenterPageId || null  // v0.88.0

      console.log('[WhiteboardStore] Loaded workspace state', { 
        role: myRole.value, 
        frozen: isBoardFrozen.value,
        presenter: presenterUserId.value,
        presenterPage: presenterPageId.value
      })
    } catch (err) {
      console.error('[WhiteboardStore] Failed to load workspace state:', err)
    }
  }
  
  /**
   * Handle presenter page changed (v0.88.0)
   */
  function handlePresenterPageChanged(payload: PresenterPageChangedPayload): void {
    console.log('[WhiteboardStore] Presenter page changed', payload)
    
    presenterPageId.value = payload.pageId
    
    // Auto-switch if follow mode is active
    if (isFollowModeActive.value && payload.pageId !== activePageId.value) {
      console.log('[WhiteboardStore] Auto-switching to presenter page', payload.pageId)
      switchToPage(payload.pageId)
    }
  }
  
  /**
   * Send presenter page switch (v0.88.0)
   */
  async function sendPresenterPageSwitch(pageId: string): Promise<void> {
    const adapter = realtimeAdapter.value as any
    if (adapter.sendPresenterPageSwitch) {
      await adapter.sendPresenterPageSwitch(pageId)
    }
  }
  
  /**
   * Toggle follow mode (v0.88.0)
   */
  function toggleFollowMode(): void {
    isFollowModeActive.value = !isFollowModeActive.value
    console.log(`[WhiteboardStore] Follow mode ${isFollowModeActive.value ? 'enabled' : 'disabled'}`)
    
    // Auto-switch to presenter page when enabling
    if (isFollowModeActive.value && presenterPageId.value && presenterPageId.value !== activePageId.value) {
      switchToPage(presenterPageId.value)
    }
  }

  /**
   * v0.87.0: Check and enter SafeMode if queue overflow
   */
  function checkSafeMode(): void {
    if (pendingOps.value.size > MAX_PENDING_OPS && !safeMode.value) {
      enterSafeMode()
    }
  }

  /**
   * v0.87.0: Enter SafeMode (queue overflow)
   */
  async function enterSafeMode(): Promise<void> {
    safeMode.value = true
    console.warn('[WhiteboardStore] Entering SafeMode: queue overflow', {
      pendingOps: pendingOps.value.size,
      maxAllowed: MAX_PENDING_OPS
    })

    // Request resync immediately
    if (activePageId.value && realtimeAdapter.value.requestResync) {
      await realtimeAdapter.value.requestResync({
        pageId: activePageId.value,
        lastKnownVersion: lastAckedVersion.value
      })
    }
  }

  /**
   * v0.87.0: Exit SafeMode after successful resync
   */
  function exitSafeMode(): void {
    if (safeMode.value) {
      safeMode.value = false
      console.log('[WhiteboardStore] Exited SafeMode: state recovered')
    }
  }

  /**
   * Reset store
   */
  function setStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter.value = adapter
  }

  function setPolicyAdapter(adapter: PolicyAdapter): void {
    policyAdapter.value = adapter
  }

  function reset(): void {
    disconnectRealtime()
    workspaceId.value = null
    pages.value = []
    activePageId.value = null
    currentPageData.value = null
    status.value = 'idle'
    error.value = null
    limits.value = { maxPages: null }
    currentVersion.value = 1
    lastAckedVersion.value = 1
    pendingOps.value.clear()
    isRecovering.value = false
    
    // v0.86.0: Reset role & moderation state
    myRole.value = 'viewer'
    isBoardFrozen.value = false
    presenterUserId.value = null
    followPresenterEnabled.value = false
    
    // v0.88.0: Reset follow-mode
    presenterPageId.value = null
    isFollowModeActive.value = false
    
    // v0.87.0: Reset SafeMode
    safeMode.value = false
    
    // v0.93.0: Reset pageStates
    pageStates.value.clear()
  }

  return {
    // State
    workspaceId,
    pages,
    showPaywallModal,
    paywallData,
    activePageId,
    currentPageData,
    status,
    error,
    limits,
    connectionStatus,
    presenceUsers,
    remoteCursors,
    currentVersion,
    lastAckedVersion,
    pendingOps,
    isRecovering,
    
    // v0.86.0: Role & Moderation
    myRole,
    isBoardFrozen,
    presenterUserId,
    followPresenterEnabled,
    
    // v0.88.0: Follow-mode
    presenterPageId,
    isFollowModeActive,
    
    // v0.87.0: SafeMode
    safeMode,

    // Computed
    activePage,
    pageCount,
    canCreatePage,
    canEdit,
    canModerate,

    // Actions
    bootstrap,
    createPage,
    switchToPage,
    loadActivePage,
    savePage,
    deletePage,
    renamePage,
    reset,
    showPaywall,
    closePaywall,
    
    // v0.93.0: Dev workspace methods
    setActivePageByScroll,
    addDevPage,
    updatePageState,
    pageStates,
    
    // Realtime
    setRealtimeAdapter,
    connectRealtime,
    disconnectRealtime,
    sendCursorMove,
    sendOperation,
    handleRemoteOperation,
    
    // Recovery (v0.85.0)
    queueOperation,
    markOpsAcked,
    applySnapshot,
    applyReplayOperations,
    
    // v0.86.0: Role & Moderation
    handleBoardFrozen,
    handlePresenterChanged,
    toggleFollowPresenter,
    sendFreeze,
    sendClearPage,
    sendSetPresenter,
    loadWorkspaceState,
    
    // v0.88.0: Follow-mode
    handlePresenterPageChanged,
    sendPresenterPageSwitch,
    toggleFollowMode,
    
    // v0.87.0: SafeMode
    checkSafeMode,
    enterSafeMode,
    exitSafeMode,

    // Dependency injection helpers
    setStorageAdapter,
    setPolicyAdapter,
  }
})
