export interface WhiteboardPage {
  id: string
  title: string
  index: number
  version: number
  updatedAt: string
}

export interface PageContent {
  pageId: string
  strokes: any[]
  assets: any[]
  version: number
}

export interface WhiteboardTask {
  id: string
  title: string
  description?: string
  pageId?: string
  completed: boolean
  createdAt: string
}
