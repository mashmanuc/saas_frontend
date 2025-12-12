import type { HistoryAction } from '../types/solo'

const MAX_HISTORY = 100

export class HistoryManager {
  private undoStack: HistoryAction[] = []
  private redoStack: HistoryAction[] = []

  push(action: HistoryAction): void {
    this.undoStack.push(action)
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  undo(): HistoryAction | null {
    const action = this.undoStack.pop()
    if (action) {
      this.redoStack.push(action)
      return action
    }
    return null
  }

  redo(): HistoryAction | null {
    const action = this.redoStack.pop()
    if (action) {
      this.undoStack.push(action)
      return action
    }
    return null
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  getUndoCount(): number {
    return this.undoStack.length
  }

  getRedoCount(): number {
    return this.redoStack.length
  }
}
