import { defineStore } from 'pinia'
import { boardApi } from '../api/board'
import { realtimeService } from '../services/realtime'
import { notifyError } from '../utils/notify'
import { useAuthStore } from '../modules/auth/store/authStore'

const AUTOSAVE_DELAY_MS = 5_000
const CURSOR_TTL_MS = 4_000

const normalizeLessonId = (value) => {
  if (value === null || value === undefined) return null
  return String(value)
}

function generateId(prefix = 'stroke') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useBoardStore = defineStore('legacy-board', {
  state: () => ({
    lessonId: null,
    strokes: [],
    undoneStrokes: [],
    tool: 'pencil',
    color: '#111827',
    thickness: 3,
    cursors: {},
    loading: false,
    saving: false,
    lastSavedAt: null,
    autosaveTimer: null,
    subscription: null,
    cursorCleanupTimer: null,
  }),

  getters: {
    canUndo(state) {
      return state.strokes.length > 0
    },
    canRedo(state) {
      return state.undoneStrokes.length > 0
    },
    activeCursors(state) {
      const now = Date.now()
      return Object.values(state.cursors).filter((entry) => now - entry.updatedAt < CURSOR_TTL_MS)
    },
  },

  actions: {
    init(lessonId) {
      if (!lessonId) return
      if (this.lessonId === lessonId) return
      this.lessonId = lessonId
      this.strokes = []
      this.undoneStrokes = []
      this.loadSnapshot()
      this.subscribeChannel()
      this.startCursorCleanup()
    },

    dispose() {
      this.lessonId = null
      this.strokes = []
      this.undoneStrokes = []
      this.cursors = {}
      if (this.subscription) {
        this.subscription()
        this.subscription = null
      }
      this.clearAutosave()
      if (this.cursorCleanupTimer) {
        clearInterval(this.cursorCleanupTimer)
        this.cursorCleanupTimer = null
      }
    },

    async loadSnapshot() {
      if (!this.lessonId) return
      this.loading = true
      try {
        const response = await boardApi.fetchSnapshot(this.lessonId)
        const snapshot = response?.data ?? response ?? {}
        const strokes = snapshot?.strokes ?? snapshot ?? []
        this.strokes = Array.isArray(strokes) ? strokes : []
        this.undoneStrokes = []
        const savedAt = snapshot?.saved_at || snapshot?.savedAt || snapshot?.updated_at
        this.lastSavedAt = savedAt || this.lastSavedAt
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося завантажити дошку.')
      } finally {
        this.loading = false
      }
    },

    addStroke(stroke, broadcast = true) {
      if (!stroke?.points?.length) return
      const entry = {
        id: stroke.id || generateId(),
        tool: stroke.tool || this.tool,
        color: stroke.color || this.color,
        thickness: stroke.thickness || this.thickness,
        points: stroke.points,
        composite: stroke.tool === 'eraser' ? 'destination-out' : 'source-over',
      }
      this.strokes = [...this.strokes, entry]
      this.undoneStrokes = []
      if (broadcast) {
        this.publishPatch(entry)
      }
      this.scheduleAutosave()
    },

    undo() {
      if (!this.strokes.length) return
      const stroke = this.strokes[this.strokes.length - 1]
      this.strokes = this.strokes.slice(0, -1)
      this.undoneStrokes = [...this.undoneStrokes, stroke]
      this.publishStrokeRemoval(stroke.id)
      this.scheduleAutosave()
    },

    redo() {
      if (!this.undoneStrokes.length) return
      const stroke = this.undoneStrokes[this.undoneStrokes.length - 1]
      this.undoneStrokes = this.undoneStrokes.slice(0, -1)
      this.addStroke(stroke, true)
    },

    clearBoard() {
      this.strokes = []
      this.undoneStrokes = []
      this.publishReset()
      this.scheduleAutosave()
    },

    setTool(tool) {
      this.tool = tool
    },
    setColor(color) {
      this.color = color
    },
    setThickness(value) {
      this.thickness = value
    },

    publishPatch(stroke) {
      if (!this.lessonId) return
      realtimeService.publish('board', {
        type: 'board.patch',
        lesson_id: this.lessonId,
        stroke,
      })
    },

    publishStrokeRemoval(strokeId) {
      if (!this.lessonId || !strokeId) return
      realtimeService.publish('board', {
        type: 'board.stroke.remove',
        lesson_id: this.lessonId,
        stroke_id: strokeId,
      })
    },

    publishReset() {
      if (!this.lessonId) return
      realtimeService.publish('board', {
        type: 'board.reset',
        lesson_id: this.lessonId,
      })
    },

    requestSnapshot() {
      if (!this.lessonId) return
      realtimeService.publish('board', {
        type: 'board.snapshot.request',
        lesson_id: this.lessonId,
      })
    },

    subscribeChannel() {
      if (this.subscription) {
        this.subscription()
        this.subscription = null
      }
      this.subscription = realtimeService.subscribe('board', (payload) => {
        if (!payload) return
        const payloadLessonId = normalizeLessonId(payload.lessonId ?? payload.lesson_id)
        if (!payloadLessonId || payloadLessonId !== normalizeLessonId(this.lessonId)) {
          return
        }
        switch (payload.type) {
          case 'board.patch':
            this.addStroke(payload.stroke, false)
            break
          case 'board.stroke.remove':
            this.removeStroke(payload.stroke_id || payload.strokeId)
            break
          case 'board.reset':
            this.strokes = []
            this.undoneStrokes = []
            break
          case 'board.snapshot.send':
            this.handleSnapshot(payload.state)
            break
          case 'board.cursor.move':
            this.updateCursor(payload.cursor)
            break
          default:
            break
        }
      })
    },

    removeStroke(strokeId) {
      if (!strokeId) return
      this.strokes = this.strokes.filter((stroke) => stroke.id !== strokeId)
    },

    scheduleAutosave() {
      this.clearAutosave()
      this.autosaveTimer = setTimeout(() => {
        this.saveSnapshot()
      }, AUTOSAVE_DELAY_MS)
    },

    clearAutosave() {
      if (this.autosaveTimer) {
        clearTimeout(this.autosaveTimer)
        this.autosaveTimer = null
      }
    },

    async saveSnapshot() {
      if (!this.lessonId || this.saving) return
      this.saving = true
      try {
        const payload = await boardApi.saveSnapshot(this.lessonId, { strokes: this.strokes })
        const savedAt = payload?.saved_at || payload?.savedAt || payload?.updated_at
        this.lastSavedAt = savedAt || new Date().toISOString()
      } catch (error) {
        notifyError(error?.response?.data?.detail || 'Не вдалося зберегти дошку.')
      } finally {
        this.saving = false
      }
    },

    sendCursor(position) {
      if (!this.lessonId || !position) return
      const auth = useAuthStore()
      const cursor = {
        userId: auth.user?.id,
        displayName: auth.user?.full_name || auth.user?.email || 'You',
        x: position.x,
        y: position.y,
      }
      this.updateCursor(cursor)
      realtimeService.publish('board', {
        type: 'board.cursor.move',
        lesson_id: this.lessonId,
        cursor,
      })
    },

    updateCursor(cursor) {
      if (!cursor?.userId) return
      this.cursors = {
        ...this.cursors,
        [cursor.userId]: {
          ...cursor,
          updatedAt: Date.now(),
        },
      }
    },

    handleSnapshot(state) {
      if (!state) return
      const strokes = state?.strokes ?? state
      this.strokes = Array.isArray(strokes) ? strokes : []
      this.undoneStrokes = []
      const savedAt = state?.saved_at || state?.savedAt || state?.updated_at
      if (savedAt) {
        this.lastSavedAt = savedAt
      }
    },

    startCursorCleanup() {
      if (this.cursorCleanupTimer) return
      this.cursorCleanupTimer = setInterval(() => {
        const now = Date.now()
        const next = {}
        Object.entries(this.cursors).forEach(([id, entry]) => {
          if (now - entry.updatedAt < CURSOR_TTL_MS) {
            next[id] = entry
          }
        })
        this.cursors = next
      }, CURSOR_TTL_MS)
    },
  },
})
