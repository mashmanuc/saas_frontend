import { ref, computed } from 'vue'
import type { Tool } from '../types/solo'

const PRESET_COLORS = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#ff9900',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#0000ff',
  '#9900ff',
  '#ff00ff',
]

const PRESET_SIZES = [2, 4, 8, 16]

export function useTools() {
  const currentTool = ref<Tool>('pen')
  const currentColor = ref('#000000')
  const currentSize = ref(2)

  const isDrawingTool = computed(() =>
    ['pen', 'highlighter', 'eraser'].includes(currentTool.value)
  )

  const isShapeTool = computed(() =>
    ['line', 'rectangle', 'circle'].includes(currentTool.value)
  )

  const isTextTool = computed(() =>
    ['text', 'note'].includes(currentTool.value)
  )

  function setTool(tool: Tool): void {
    currentTool.value = tool
  }

  function setColor(color: string): void {
    currentColor.value = color
  }

  function setSize(size: number): void {
    currentSize.value = size
  }

  function handleKeyboardShortcut(key: string): boolean {
    const shortcuts: Record<string, Tool> = {
      p: 'pen',
      h: 'highlighter',
      e: 'eraser',
      l: 'line',
      r: 'rectangle',
      c: 'circle',
      t: 'text',
      n: 'note',
      s: 'select',
    }

    const tool = shortcuts[key.toLowerCase()]
    if (tool) {
      setTool(tool)
      return true
    }
    return false
  }

  return {
    currentTool,
    currentColor,
    currentSize,
    isDrawingTool,
    isShapeTool,
    isTextTool,
    setTool,
    setColor,
    setSize,
    handleKeyboardShortcut,
    PRESET_COLORS,
    PRESET_SIZES,
  }
}
