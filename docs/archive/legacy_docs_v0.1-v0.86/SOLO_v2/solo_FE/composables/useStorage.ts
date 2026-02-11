import { ref } from 'vue'
import type { WorkspaceState, PageState } from '../types/solo'

const STORAGE_KEY = 'solo-workspace'
const AUTOSAVE_INTERVAL = 10000

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useStorage() {
  const lastSaved = ref<Date | null>(null)
  const isSaving = ref(false)
  let autosaveTimer: ReturnType<typeof setInterval> | null = null

  function save(pages: PageState[], name = 'Untitled'): void {
    const state: WorkspaceState = {
      id: generateId(),
      name,
      pages,
      activePageId: pages[0]?.id || '',
      zoom: 1,
      pan: { x: 0, y: 0 },
      fullscreen: false,
      updatedAt: Date.now(),
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      lastSaved.value = new Date()
    } catch (err) {
      console.error('[useStorage] Failed to save:', err)
    }
  }

  function load(): WorkspaceState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as WorkspaceState
    } catch (err) {
      console.error('[useStorage] Failed to load:', err)
      return null
    }
  }

  function clear(): void {
    localStorage.removeItem(STORAGE_KEY)
    lastSaved.value = null
  }

  function startAutosave(getPages: () => PageState[], getName: () => string): void {
    stopAutosave()
    autosaveTimer = setInterval(() => {
      save(getPages(), getName())
    }, AUTOSAVE_INTERVAL)
  }

  function stopAutosave(): void {
    if (autosaveTimer) {
      clearInterval(autosaveTimer)
      autosaveTimer = null
    }
  }

  function exportPNG(canvas: HTMLCanvasElement, filename = 'solo-workspace.png'): void {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function exportJSON(pages: PageState[], filename = 'solo-workspace.json'): void {
    const data = JSON.stringify(pages, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.download = filename
    link.href = url
    link.click()

    URL.revokeObjectURL(url)
  }

  function importJSON(file: File): Promise<PageState[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const pages = JSON.parse(e.target?.result as string) as PageState[]
          resolve(pages)
        } catch (err) {
          reject(new Error('Invalid JSON file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  return {
    lastSaved,
    isSaving,
    save,
    load,
    clear,
    startAutosave,
    stopAutosave,
    exportPNG,
    exportJSON,
    importJSON,
  }
}
