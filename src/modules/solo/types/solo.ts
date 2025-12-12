export type Tool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'note'
  | 'select'

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  tool: Exclude<Tool, 'text' | 'note' | 'select'>
  color: string
  size: number
  opacity: number
  points: Point[]
  composite?: GlobalCompositeOperation
}

export interface Shape {
  id: string
  type: 'line' | 'rectangle' | 'circle'
  color: string
  size: number
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface TextElement {
  id: string
  type: 'text' | 'note'
  text: string
  x: number
  y: number
  color: string
  fontSize: number
  width?: number
  height?: number
}

export interface PageState {
  id: string
  name: string
  strokes: Stroke[]
  shapes: Shape[]
  texts: TextElement[]
}

export interface HistoryAction {
  pageId: string
  type: 'add-stroke' | 'remove-stroke' | 'add-shape' | 'remove-shape' | 'add-text' | 'remove-text' | 'update-state'
  payload: Stroke | Shape | TextElement | PageState
}

export interface WorkspaceState {
  id: string
  name: string
  pages: PageState[]
  activePageId: string
  zoom: number
  pan: Point
  fullscreen: boolean
  updatedAt: number
}
