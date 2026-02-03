import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useKeyboardShortcuts, TOOL_SHORTCUTS, getShortcutDisplay, getToolShortcut } from './useKeyboardShortcuts'

// Mock navigator.platform
const originalNavigator = global.navigator

describe('useKeyboardShortcuts', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Mock window event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('TOOL_SHORTCUTS', () => {
    it('should have all expected tool shortcuts', () => {
      expect(TOOL_SHORTCUTS['p']).toBe('pen')
      expect(TOOL_SHORTCUTS['h']).toBe('highlighter')
      expect(TOOL_SHORTCUTS['e']).toBe('eraser')
      expect(TOOL_SHORTCUTS['l']).toBe('line')
      expect(TOOL_SHORTCUTS['a']).toBe('arrow')
      expect(TOOL_SHORTCUTS['r']).toBe('rectangle')
      expect(TOOL_SHORTCUTS['c']).toBe('circle')
      expect(TOOL_SHORTCUTS['t']).toBe('text')
      expect(TOOL_SHORTCUTS['n']).toBe('note')
      expect(TOOL_SHORTCUTS['v']).toBe('select')
    })

    it('should have 10 tool shortcuts', () => {
      expect(Object.keys(TOOL_SHORTCUTS)).toHaveLength(10)
    })
  })

  describe('getToolShortcut', () => {
    it('should return uppercase key for tool', () => {
      expect(getToolShortcut('pen')).toBe('P')
      expect(getToolShortcut('circle')).toBe('C')
      expect(getToolShortcut('select')).toBe('V')
    })

    it('should return empty string for unknown tool', () => {
      expect(getToolShortcut('unknown' as any)).toBe('')
    })
  })

  describe('getShortcutDisplay', () => {
    it('should return key for simple shortcuts', () => {
      expect(getShortcutDisplay('pen')).toBe('P')
      expect(getShortcutDisplay('delete')).toBe('Delete')
      expect(getShortcutDisplay('escape')).toBe('Escape')
    })

    it('should return empty string for unknown action', () => {
      expect(getShortcutDisplay('unknown-action')).toBe('')
    })
  })

  describe('useKeyboardShortcuts composable', () => {
    it('should register event listeners on mount', () => {
      const { isPanning } = useKeyboardShortcuts({})

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    })

    it('should return isPanning ref', () => {
      const { isPanning } = useKeyboardShortcuts({})

      expect(isPanning.value).toBe(false)
    })

    it('should return enable/disable functions', () => {
      const { enable, disable } = useKeyboardShortcuts({})

      expect(typeof enable).toBe('function')
      expect(typeof disable).toBe('function')
    })

    it('should call onToolChange when tool key is pressed', () => {
      const onToolChange = vi.fn()
      useKeyboardShortcuts({ onToolChange })

      // Simulate keydown event
      const event = new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      })
      window.dispatchEvent(event)

      expect(onToolChange).toHaveBeenCalledWith('pen')
    })

    it('should call onUndo when Ctrl+Z is pressed', () => {
      const onUndo = vi.fn()
      useKeyboardShortcuts({ onUndo })

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: false,
      })
      window.dispatchEvent(event)

      expect(onUndo).toHaveBeenCalled()
    })

    it('should call onRedo when Ctrl+Shift+Z is pressed', () => {
      const onRedo = vi.fn()
      useKeyboardShortcuts({ onRedo })

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
      })
      window.dispatchEvent(event)

      expect(onRedo).toHaveBeenCalled()
    })

    it('should call onEscape when Escape is pressed', () => {
      const onEscape = vi.fn()
      useKeyboardShortcuts({ onEscape })

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
      })
      window.dispatchEvent(event)

      expect(onEscape).toHaveBeenCalled()
    })

    it('should call onDelete when Delete key is pressed', () => {
      const onDelete = vi.fn()
      useKeyboardShortcuts({ onDelete })

      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
      })
      window.dispatchEvent(event)

      expect(onDelete).toHaveBeenCalled()
    })

    it('should call onZoomIn when Ctrl+= is pressed', () => {
      const onZoomIn = vi.fn()
      useKeyboardShortcuts({ onZoomIn })

      const event = new KeyboardEvent('keydown', {
        key: '=',
        ctrlKey: true,
      })
      window.dispatchEvent(event)

      expect(onZoomIn).toHaveBeenCalled()
    })

    it('should not trigger shortcuts when disabled', () => {
      const onToolChange = vi.fn()
      const { disable } = useKeyboardShortcuts({ onToolChange })

      disable()

      const event = new KeyboardEvent('keydown', {
        key: 'p',
      })
      window.dispatchEvent(event)

      expect(onToolChange).not.toHaveBeenCalled()
    })

    it('should resume shortcuts when re-enabled', () => {
      const onToolChange = vi.fn()
      const { disable, enable } = useKeyboardShortcuts({ onToolChange })

      disable()
      enable()

      const event = new KeyboardEvent('keydown', {
        key: 'p',
      })
      window.dispatchEvent(event)

      expect(onToolChange).toHaveBeenCalledWith('pen')
    })
  })

  describe('Pan mode', () => {
    it('should set isPanning to true when space is pressed', () => {
      const onPanStart = vi.fn()
      const { isPanning } = useKeyboardShortcuts({ onPanStart })

      const event = new KeyboardEvent('keydown', {
        key: ' ',
      })
      window.dispatchEvent(event)

      expect(isPanning.value).toBe(true)
      expect(onPanStart).toHaveBeenCalled()
    })

    it('should set isPanning to false when space is released', () => {
      const onPanEnd = vi.fn()
      const { isPanning } = useKeyboardShortcuts({ onPanEnd })

      // Press space
      const keydownEvent = new KeyboardEvent('keydown', { key: ' ' })
      window.dispatchEvent(keydownEvent)

      expect(isPanning.value).toBe(true)

      // Release space
      const keyupEvent = new KeyboardEvent('keyup', { key: ' ' })
      window.dispatchEvent(keyupEvent)

      expect(isPanning.value).toBe(false)
      expect(onPanEnd).toHaveBeenCalled()
    })
  })
})
