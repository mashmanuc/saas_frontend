import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { Tool } from '../types/solo'

export interface ShortcutAction {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: string
  description: string
}

export interface KeyboardShortcutsOptions {
  onToolChange?: (tool: Tool) => void
  onUndo?: () => void
  onRedo?: () => void
  onDelete?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onSelectAll?: () => void
  onEscape?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
  onPanStart?: () => void
  onPanEnd?: () => void
}

// Detect Mac vs Windows/Linux
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

// Modifier key display names
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'
export const ALT_KEY = isMac ? '⌥' : 'Alt'
export const SHIFT_KEY = '⇧'

// Tool shortcuts mapping
export const TOOL_SHORTCUTS: Record<string, Tool> = {
  'p': 'pen',
  'h': 'highlighter',
  'e': 'eraser',
  'l': 'line',
  'a': 'arrow',
  'r': 'rectangle',
  'c': 'circle',
  't': 'text',
  'n': 'note',
  'v': 'select',
}

// All shortcuts for documentation and UI
export const ALL_SHORTCUTS: ShortcutAction[] = [
  // Drawing tools
  { key: 'P', action: 'pen', description: 'Pen tool' },
  { key: 'H', action: 'highlighter', description: 'Highlighter tool' },
  { key: 'E', action: 'eraser', description: 'Eraser tool' },
  { key: 'L', action: 'line', description: 'Line tool' },
  { key: 'A', action: 'arrow', description: 'Arrow tool' },
  { key: 'R', action: 'rectangle', description: 'Rectangle tool' },
  { key: 'C', action: 'circle', description: 'Circle tool' },
  { key: 'T', action: 'text', description: 'Text tool' },
  { key: 'N', action: 'note', description: 'Sticky note' },
  { key: 'V', action: 'select', description: 'Select tool' },

  // Actions with modifiers
  { key: 'Z', ctrl: true, action: 'undo', description: 'Undo' },
  { key: 'Z', ctrl: true, shift: true, action: 'redo', description: 'Redo' },
  { key: 'Y', ctrl: true, action: 'redo', description: 'Redo (alternative)' },
  { key: 'C', ctrl: true, action: 'copy', description: 'Copy selection' },
  { key: 'V', ctrl: true, action: 'paste', description: 'Paste' },
  { key: 'A', ctrl: true, action: 'select-all', description: 'Select all' },
  { key: 'Delete', action: 'delete', description: 'Delete selected' },
  { key: 'Backspace', action: 'delete', description: 'Delete selected' },
  { key: 'Escape', action: 'escape', description: 'Deselect / Cancel' },

  // Zoom
  { key: '=', ctrl: true, action: 'zoom-in', description: 'Zoom in' },
  { key: '+', ctrl: true, action: 'zoom-in', description: 'Zoom in' },
  { key: '-', ctrl: true, action: 'zoom-out', description: 'Zoom out' },
  { key: '0', ctrl: true, action: 'zoom-reset', description: 'Reset zoom (100%)' },

  // Pan
  { key: ' ', action: 'pan-start', description: 'Pan mode (hold)' },
]

// Get display shortcut for UI
export function getShortcutDisplay(action: string): string {
  const shortcut = ALL_SHORTCUTS.find(s => s.action === action)
  if (!shortcut) return ''

  const parts: string[] = []
  if (shortcut.ctrl) parts.push(MOD_KEY)
  if (shortcut.shift) parts.push(SHIFT_KEY)
  if (shortcut.alt) parts.push(ALT_KEY)
  parts.push(shortcut.key)

  return parts.join(isMac ? '' : '+')
}

// Get shortcut for tool
export function getToolShortcut(tool: Tool): string {
  const entry = Object.entries(TOOL_SHORTCUTS).find(([_, t]) => t === tool)
  return entry ? entry[0].toUpperCase() : ''
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const isPanning = ref(false)
  const isEnabled = ref(true)

  // Check if we should ignore the event (when typing in input)
  function shouldIgnoreEvent(event: KeyboardEvent): boolean {
    if (!isEnabled.value) return true

    const target = event.target as HTMLElement
    const tagName = target.tagName.toLowerCase()

    // Ignore when typing in inputs
    if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
      // Allow Escape in inputs
      if (event.key === 'Escape') return false
      // Allow Ctrl+A, Ctrl+C, Ctrl+V in inputs (browser default)
      return true
    }

    return false
  }

  // Check if modifier key matches (Ctrl on Windows, Cmd on Mac)
  function hasModifier(event: KeyboardEvent): boolean {
    return isMac ? event.metaKey : event.ctrlKey
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (shouldIgnoreEvent(event)) return

    const key = event.key.toLowerCase()
    const hasCtrl = hasModifier(event)
    const hasShift = event.shiftKey

    // Space for pan mode
    if (key === ' ' && !hasCtrl && !hasShift) {
      event.preventDefault()
      if (!isPanning.value) {
        isPanning.value = true
        options.onPanStart?.()
      }
      return
    }

    // Escape - always works
    if (key === 'escape') {
      event.preventDefault()
      options.onEscape?.()
      return
    }

    // Delete/Backspace
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      options.onDelete?.()
      return
    }

    // Ctrl/Cmd + key combinations
    if (hasCtrl) {
      switch (key) {
        case 'z':
          event.preventDefault()
          if (hasShift) {
            options.onRedo?.()
          } else {
            options.onUndo?.()
          }
          return

        case 'y':
          event.preventDefault()
          options.onRedo?.()
          return

        case 'c':
          // Don't prevent default - let browser handle copy
          options.onCopy?.()
          return

        case 'v':
          // Don't prevent default - let browser handle paste
          options.onPaste?.()
          return

        case 'a':
          event.preventDefault()
          options.onSelectAll?.()
          return

        case '=':
        case '+':
          event.preventDefault()
          options.onZoomIn?.()
          return

        case '-':
          event.preventDefault()
          options.onZoomOut?.()
          return

        case '0':
          event.preventDefault()
          options.onZoomReset?.()
          return
      }
    }

    // Tool shortcuts (single key, no modifiers)
    if (!hasCtrl && !hasShift && !event.altKey) {
      const tool = TOOL_SHORTCUTS[key]
      if (tool) {
        event.preventDefault()
        options.onToolChange?.(tool)
        return
      }
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    // Release pan mode on space release
    if (event.key === ' ' && isPanning.value) {
      isPanning.value = false
      options.onPanEnd?.()
    }
  }

  function enable(): void {
    isEnabled.value = true
  }

  function disable(): void {
    isEnabled.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  })

  return {
    isPanning,
    isEnabled,
    enable,
    disable,
    getShortcutDisplay,
    getToolShortcut,
    isMac,
    MOD_KEY,
    ALL_SHORTCUTS,
    TOOL_SHORTCUTS,
  }
}

export default useKeyboardShortcuts
