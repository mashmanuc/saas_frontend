// F6: useLayoutManager - Layout management composable
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoomStore, type LayoutMode } from '../stores/roomStore'

export interface LayoutManagerOptions {
  defaultMode?: LayoutMode
  mobileBreakpoint?: number
  persistPreference?: boolean
}

const STORAGE_KEY = 'classroom_layout_preference'

export function useLayoutManager(options: LayoutManagerOptions = {}) {
  const {
    defaultMode = 'side-by-side',
    mobileBreakpoint = 768,
    persistPreference = true,
  } = options

  const roomStore = useRoomStore()

  // State
  const isMobile = ref(false)
  const isFullscreen = ref(false)
  const videoPanelWidth = ref(30) // percentage
  const boardPanelWidth = ref(70) // percentage

  // Computed
  const currentMode = computed(() => roomStore.layoutMode)

  const availableModes = computed<LayoutMode[]>(() => {
    if (isMobile.value) {
      return ['pip', 'video-focus', 'board-focus']
    }
    return ['side-by-side', 'pip', 'board-focus', 'video-focus']
  })

  const layoutConfig = computed(() => ({
    mode: currentMode.value,
    isMobile: isMobile.value,
    isFullscreen: isFullscreen.value,
    videoPanelWidth: videoPanelWidth.value,
    boardPanelWidth: boardPanelWidth.value,
  }))

  // Set layout mode
  function setMode(mode: LayoutMode): void {
    if (!availableModes.value.includes(mode)) {
      console.warn(`[useLayoutManager] Mode "${mode}" not available on this device`)
      return
    }

    roomStore.setLayoutMode(mode)

    if (persistPreference) {
      localStorage.setItem(STORAGE_KEY, mode)
    }
  }

  // Cycle through available modes
  function cycleMode(): void {
    const modes = availableModes.value
    const currentIndex = modes.indexOf(currentMode.value)
    const nextIndex = (currentIndex + 1) % modes.length
    setMode(modes[nextIndex])
  }

  // Toggle fullscreen
  async function toggleFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        isFullscreen.value = true
      } else {
        await document.exitFullscreen()
        isFullscreen.value = false
      }
    } catch (error) {
      console.error('[useLayoutManager] Fullscreen error:', error)
    }
  }

  // Resize panels (for side-by-side mode)
  function resizePanels(videoWidth: number): void {
    if (videoWidth < 20) videoWidth = 20
    if (videoWidth > 80) videoWidth = 80

    videoPanelWidth.value = videoWidth
    boardPanelWidth.value = 100 - videoWidth
  }

  // Reset to default panel sizes
  function resetPanelSizes(): void {
    videoPanelWidth.value = 30
    boardPanelWidth.value = 70
  }

  // Check if device is mobile
  function checkMobile(): void {
    isMobile.value = window.innerWidth < mobileBreakpoint
  }

  // Handle resize
  function handleResize(): void {
    checkMobile()

    // Auto-switch to mobile-friendly layout
    if (isMobile.value && currentMode.value === 'side-by-side') {
      setMode('pip')
    }
  }

  // Handle fullscreen change
  function handleFullscreenChange(): void {
    isFullscreen.value = !!document.fullscreenElement
  }

  // Load saved preference
  function loadPreference(): void {
    if (!persistPreference) return

    const saved = localStorage.getItem(STORAGE_KEY) as LayoutMode | null
    if (saved && availableModes.value.includes(saved)) {
      roomStore.setLayoutMode(saved)
    } else {
      roomStore.setLayoutMode(defaultMode)
    }
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent): void {
    // Only handle if not in input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    switch (event.key) {
      case 'l':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          cycleMode()
        }
        break
      case 'f':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          toggleFullscreen()
        }
        break
    }
  }

  // Lifecycle
  onMounted(() => {
    checkMobile()
    loadPreference()

    window.addEventListener('resize', handleResize)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    // State
    currentMode,
    isMobile,
    isFullscreen,
    videoPanelWidth,
    boardPanelWidth,
    availableModes,
    layoutConfig,

    // Actions
    setMode,
    cycleMode,
    toggleFullscreen,
    resizePanels,
    resetPanelSizes,
  }
}
