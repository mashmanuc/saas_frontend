import { ref, computed } from 'vue'
import type { PageState, Stroke, Shape, TextElement } from '../types/solo'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createEmptyPage(name?: string): PageState {
  return {
    id: generateId(),
    name: name || 'Page 1',
    strokes: [],
    shapes: [],
    texts: [],
  }
}

export function usePages() {
  const pages = ref<PageState[]>([createEmptyPage()])
  const activePageId = ref(pages.value[0].id)

  const activePage = computed(() =>
    pages.value.find((p) => p.id === activePageId.value) || pages.value[0]
  )

  const activePageIndex = computed(() =>
    pages.value.findIndex((p) => p.id === activePageId.value)
  )

  const pageCount = computed(() => pages.value.length)

  function addPage(): PageState {
    const newPage = createEmptyPage(`Page ${pages.value.length + 1}`)
    pages.value.push(newPage)
    activePageId.value = newPage.id
    return newPage
  }

  function deletePage(pageId: string): boolean {
    if (pages.value.length <= 1) return false

    const idx = pages.value.findIndex((p) => p.id === pageId)
    if (idx === -1) return false

    pages.value.splice(idx, 1)

    if (activePageId.value === pageId) {
      activePageId.value = pages.value[Math.max(0, idx - 1)].id
    }

    return true
  }

  function switchPage(pageId: string): void {
    if (pages.value.some((p) => p.id === pageId)) {
      activePageId.value = pageId
    }
  }

  function renamePage(pageId: string, name: string): void {
    const page = pages.value.find((p) => p.id === pageId)
    if (page) {
      page.name = name
    }
  }

  function addStroke(stroke: Stroke): void {
    activePage.value.strokes.push(stroke)
  }

  function removeStroke(strokeId: string): Stroke | null {
    const idx = activePage.value.strokes.findIndex((s) => s.id === strokeId)
    if (idx !== -1) {
      return activePage.value.strokes.splice(idx, 1)[0]
    }
    return null
  }

  function addShape(shape: Shape): void {
    activePage.value.shapes.push(shape)
  }

  function removeShape(shapeId: string): Shape | null {
    const idx = activePage.value.shapes.findIndex((s) => s.id === shapeId)
    if (idx !== -1) {
      return activePage.value.shapes.splice(idx, 1)[0]
    }
    return null
  }

  function addText(text: TextElement): void {
    activePage.value.texts.push(text)
  }

  function removeText(textId: string): TextElement | null {
    const idx = activePage.value.texts.findIndex((t) => t.id === textId)
    if (idx !== -1) {
      return activePage.value.texts.splice(idx, 1)[0]
    }
    return null
  }

  function clearPage(): void {
    activePage.value.strokes = []
    activePage.value.shapes = []
    activePage.value.texts = []
  }

  function setPages(newPages: PageState[]): void {
    if (newPages.length === 0) {
      pages.value = [createEmptyPage()]
    } else {
      pages.value = newPages
    }
    activePageId.value = pages.value[0].id
  }

  function getPageState(): PageState[] {
    return JSON.parse(JSON.stringify(pages.value))
  }

  return {
    pages,
    activePageId,
    activePage,
    activePageIndex,
    pageCount,
    addPage,
    deletePage,
    switchPage,
    renamePage,
    addStroke,
    removeStroke,
    addShape,
    removeShape,
    addText,
    removeText,
    clearPage,
    setPages,
    getPageState,
  }
}
