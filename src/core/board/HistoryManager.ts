// TASK F7: HistoryManager - Undo/redo with sync

import { BoardEventEmitter } from './eventEmitter'
import type { HistoryAction, HistoryEntry, HistoryEntryData } from './types'
import { MAX_HISTORY_ENTRIES } from './constants'

type HistoryEvents = {
  'history-change': { canUndo: boolean; canRedo: boolean }
  undo: HistoryEntry
  redo: HistoryEntry
  [key: string]: unknown
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private maxHistory: number
  private batchId: string | null = null
  private batchEntries: HistoryEntry[] = []

  public readonly events = new BoardEventEmitter<HistoryEvents>()

  constructor(maxHistory: number = MAX_HISTORY_ENTRIES) {
    this.maxHistory = maxHistory
  }

  record(action: HistoryAction, componentId: string | null, previousState: unknown, newState: unknown): void {
    const entry: HistoryEntry = {
      id: this.generateId(),
      action,
      componentId,
      previousState,
      newState,
      timestamp: Date.now(),
      batchId: this.batchId ?? undefined,
    }

    if (this.batchId) {
      this.batchEntries.push(entry)
    } else {
      this.addEntry(entry)
    }
  }

  startBatch(): string {
    this.batchId = this.generateId()
    this.batchEntries = []
    return this.batchId
  }

  endBatch(): void {
    if (!this.batchId || this.batchEntries.length === 0) {
      this.batchId = null
      this.batchEntries = []
      return
    }

    // Create a batch entry containing all individual entries
    const batchEntry: HistoryEntry = {
      id: this.batchId,
      action: 'batch',
      componentId: null,
      previousState: this.batchEntries.map((e) => ({
        action: e.action,
        componentId: e.componentId,
        state: e.previousState,
      })),
      newState: this.batchEntries.map((e) => ({
        action: e.action,
        componentId: e.componentId,
        state: e.newState,
      })),
      timestamp: Date.now(),
    }

    this.addEntry(batchEntry)
    this.batchId = null
    this.batchEntries = []
  }

  undo(): HistoryEntry | null {
    if (this.undoStack.length === 0) return null

    const entry = this.undoStack.pop()!
    this.redoStack.push(entry)

    this.emitChange()
    this.events.emit('undo', entry)
    return entry
  }

  redo(): HistoryEntry | null {
    if (this.redoStack.length === 0) return null

    const entry = this.redoStack.pop()!
    this.undoStack.push(entry)

    this.emitChange()
    this.events.emit('redo', entry)
    return entry
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  getUndoStack(): HistoryEntry[] {
    return [...this.undoStack]
  }

  getRedoStack(): HistoryEntry[] {
    return [...this.redoStack]
  }

  getLastEntry(): HistoryEntry | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.batchId = null
    this.batchEntries = []
    this.emitChange()
  }

  loadHistory(entries: HistoryEntryData[]): void {
    this.undoStack = entries.map((e) => ({
      ...e,
      timestamp: e.timestamp,
    }))
    this.redoStack = []
    this.emitChange()
  }

  getHistoryForSync(): HistoryEntryData[] {
    return this.undoStack.map((entry) => ({
      id: entry.id,
      action: entry.action,
      componentId: entry.componentId,
      previousState: entry.previousState,
      newState: entry.newState,
      timestamp: entry.timestamp,
      batchId: entry.batchId,
    }))
  }

  getEntryCount(): number {
    return this.undoStack.length
  }

  private addEntry(entry: HistoryEntry): void {
    this.undoStack.push(entry)

    // Clear redo stack on new action
    this.redoStack = []

    // Trim history if needed
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }

    this.emitChange()
  }

  private emitChange(): void {
    this.events.emit('history-change', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    })
  }

  private generateId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default HistoryManager
