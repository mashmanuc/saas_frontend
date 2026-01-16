/**
 * Whiteboard Store for Classroom
 * v0.83.0 - Pages management with adapters and paywall support
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StorageAdapter, PolicyAdapter, PageMetadata, PageData } from '@/core/whiteboard/adapters'
import type { RealtimeAdapter, PresenceUser, RemoteCursor, BoardOperation } from '@/core/whiteboard/adapters/RealtimeAdapter'
import { M4shStorageAdapter, M4shPolicyAdapter } from '../adapters'
import { NoopRealtimeAdapter } from '@/core/whiteboard/adapters/NoopRealtimeAdapter'

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

  // Computed
  const activePage = computed(() => pages.value.find(p => p.id === activePageId.value) || null)
  const pageCount = computed(() => pages.value.length)
  const canCreatePage = computed(() => {
    if (limits.value.maxPages === null) return true
    return pageCount.value < limits.value.maxPages
  })

  /**
   * Bootstrap whiteboard for workspace
   */
  async function bootstrap(wsId: string): Promise<void> {
    workspaceId.value = wsId
    status.value = 'loading'
    error.value = null

    try {
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
   * Load active page data
   */
  async function loadActivePage(): Promise<void> {
    if (!activePageId.value) return

    try {
      const pageData = await storageAdapter.value.loadPage(activePageId.value)
      currentPageData.value = pageData
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
   * Handle version conflict
   */
  async function handleVersionConflict(event: CustomEvent): Promise<void> {
    const { pageId, currentVersion } = event.detail
    console.warn('[WhiteboardStore] Version conflict, reloading page', { pageId, currentVersion })
    
    if (pageId === activePageId.value) {
      await loadActivePage()
    }
  }

  /**
   * Reset store
   */
  function reset(): void {
    disconnectRealtime()
    workspaceId.value = null
    pages.value = []
    activePageId.value = null
    currentPageData.value = null
    status.value = 'idle'
    error.value = null
    limits.value = { maxPages: null }
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

    // Computed
    activePage,
    pageCount,
    canCreatePage,

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
    
    // Realtime
    setRealtimeAdapter,
    connectRealtime,
    disconnectRealtime,
    sendCursorMove,
    sendOperation,
    handleRemoteOperation,
  }
})
