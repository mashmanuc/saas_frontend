/**
 * Pinia store для Platform Feedback.
 *
 * Тримає bounded cache threads (за id) + поточний фільтр + comments per thread.
 * UI components читають через computed → reactive updates після mutations.
 *
 * B5 (audit 2026-05-24): LRU eviction щоб уникнути unbounded memory growth.
 * User, що navigates 1000 threads, не повинен накопичувати 1000 entries.
 * Кешуємо до THREADS_CACHE_MAX (200) + COMMENTS_CACHE_MAX (50) thread comments.
 * Eviction strategy: коли cap перевищено, видаляємо найстаріший entry, який
 * НЕ присутній у поточному `listIds` (live list defended).
 */
import { defineStore } from 'pinia'
import api from '../api/feedbackApi'

/**
 * H1 (2026-05-27): parse API error response у user-friendly формат.
 * Підтримує 3 contract shapes:
 *   1. SSOT: {error: 'code', detail: 'message', fields?: {f: [msgs]}}
 *   2. Wrapper: {code: 'VALIDATION_ERROR', detail: '...', fields?: {...}}
 *   3. DRF raw: {field: ['msg1'], non_field_errors: [...]}
 * Returns {message: string, fields: {[name]: string[]}}
 */
function parseApiError(data) {
  const fallback = { message: 'Помилка створення', fields: {} }
  if (!data) return fallback
  if (typeof data === 'string') return { message: data, fields: {} }
  if (typeof data !== 'object') return fallback

  // Detect per-field errors
  let fields = {}
  if (data.fields && typeof data.fields === 'object' && !Array.isArray(data.fields)) {
    fields = data.fields
  } else {
    // DRF raw: keys are field names, values are arrays of strings
    const candidate = {}
    for (const [k, v] of Object.entries(data)) {
      if (['error', 'code', 'detail', 'message', 'meta'].includes(k)) continue
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
        candidate[k] = v
      }
    }
    if (Object.keys(candidate).length > 0) fields = candidate
  }

  // User-facing message: prefer detail/message, fallback на field-summary
  let message = data.detail || data.message
  if (!message && Object.keys(fields).length > 0) {
    // "title: error; description: error" — short summary
    message = Object.entries(fields)
      .map(([k, msgs]) => `${k}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
      .join('; ')
  }
  if (!message) message = fallback.message
  // Ensure string (захист від випадкового object dump)
  if (typeof message !== 'string') message = fallback.message

  return { message, fields }
}

const THREADS_CACHE_MAX = 200
const COMMENTS_CACHE_MAX = 50

export const useFeedbackStore = defineStore('platformFeedback', {
  state: () => ({
    // threads by id
    threadsById: {},
    // LRU order (oldest first) — tracks access for eviction.
    _threadOrder: [],
    // remembered list ids for current filter
    listIds: [],
    listMeta: { page: 1, page_size: 20, total: 0 },
    listFilter: { sort: 'recent' },
    listLoading: false,
    listError: null,

    // detail
    detailLoading: false,
    detailError: null,

    // comments by threadId
    commentsByThread: {},
    _commentsOrder: [],

    // similar threads (last query)
    similarResults: [],
    similarLoading: false,

    // create thread
    createLoading: false,
    createError: null,
    // H1 (2026-05-27): per-field errors для inline display під inputs.
    // Map: { title: [...], description: [...], category: [...] }
    createFieldErrors: {},

    // A6 (audit 2026-05-24): optimistic vote tracking.
    // Set<threadId> з in-flight toggleVote → блокує double-click + race.
    _votingInflight: new Set(),

    // Останній user-facing vote error (для toast/banner).
    voteError: null,
  }),

  getters: {
    listThreads(state) {
      return state.listIds.map((id) => state.threadsById[id]).filter(Boolean)
    },
    threadById: (state) => (id) => state.threadsById[id],
    commentsFor: (state) => (id) => state.commentsByThread[id] || [],
  },

  actions: {
    _upsertThread(thread) {
      if (!thread || !thread.id) return
      const id = thread.id
      const existing = this.threadsById[id]
      this.threadsById = {
        ...this.threadsById,
        [id]: { ...existing, ...thread },
      }
      // LRU: bump до кінця.
      const idx = this._threadOrder.indexOf(id)
      if (idx >= 0) this._threadOrder.splice(idx, 1)
      this._threadOrder.push(id)
      this._evictThreadsIfOver()
    },

    _evictThreadsIfOver() {
      if (this._threadOrder.length <= THREADS_CACHE_MAX) return
      // Захищаємо: listIds (поточна list view) + last detail thread.
      const protected_ = new Set(this.listIds.map(String))
      const tail = this._threadOrder[this._threadOrder.length - 1]
      if (tail !== undefined) protected_.add(String(tail))
      const toEvict = []
      for (const id of this._threadOrder) {
        if (this._threadOrder.length - toEvict.length <= THREADS_CACHE_MAX) break
        if (!protected_.has(String(id))) toEvict.push(id)
      }
      if (!toEvict.length) return
      const next = { ...this.threadsById }
      for (const id of toEvict) delete next[id]
      this.threadsById = next
      this._threadOrder = this._threadOrder.filter((id) => !toEvict.includes(id))
      // Заодно скинути comments цих threads
      const nextComments = { ...this.commentsByThread }
      for (const id of toEvict) delete nextComments[id]
      this.commentsByThread = nextComments
      this._commentsOrder = this._commentsOrder.filter((id) => !toEvict.includes(id))
    },

    _trackCommentsAccess(threadId) {
      const idx = this._commentsOrder.indexOf(threadId)
      if (idx >= 0) this._commentsOrder.splice(idx, 1)
      this._commentsOrder.push(threadId)
      while (this._commentsOrder.length > COMMENTS_CACHE_MAX) {
        const evict = this._commentsOrder.shift()
        if (evict != null) {
          const next = { ...this.commentsByThread }
          delete next[evict]
          this.commentsByThread = next
        }
      }
    },

    async loadList(filter = {}) {
      this.listLoading = true
      this.listError = null
      this.listFilter = { ...this.listFilter, ...filter }
      try {
        const { data, meta } = await api.listThreads(this.listFilter)
        data.forEach((t) => this._upsertThread(t))
        this.listIds = data.map((t) => t.id)
        this.listMeta = meta
      } catch (err) {
        this.listError = err?.response?.data?.detail || 'Помилка завантаження'
        throw err
      } finally {
        this.listLoading = false
      }
    },

    async loadDetail(id) {
      this.detailLoading = true
      this.detailError = null
      try {
        const t = await api.getThread(id)
        this._upsertThread(t)
        return t
      } catch (err) {
        this.detailError = err?.response?.data?.detail || 'Помилка завантаження'
        throw err
      } finally {
        this.detailLoading = false
      }
    },

    async createThread(payload) {
      this.createLoading = true
      this.createError = null
      this.createFieldErrors = {}
      try {
        const t = await api.createThread(payload)
        this._upsertThread(t)
        // C2 (audit 2026-05-24): новий thread має priority_score=0 → у sort=trending
        // він би впав у самий хвіст. Prepend до listIds щоб user одразу бачив свою
        // ідею при поверненні на /feedback (immediate-feedback UX).
        if (!this.listIds.includes(t.id)) {
          this.listIds = [t.id, ...this.listIds]
          this.listMeta = { ...this.listMeta, total: (this.listMeta.total || 0) + 1 }
        }
        return t
      } catch (err) {
        // H1 (2026-05-27): robust error parsing — НЕ дампимо raw JSON на UI.
        // Підтримуємо два error contract:
        //   1. SSOT envelope: {error, detail, fields?}
        //   2. Backend wrapper: {code, detail, fields?}  ← VALIDATION_ERROR
        //   3. DRF raw:        {field: [...]}
        const data = err?.response?.data
        const parsed = parseApiError(data)
        this.createError = parsed.message
        this.createFieldErrors = parsed.fields
        throw err
      } finally {
        this.createLoading = false
      }
    },

    /**
     * A6: optimistic toggle vote з rollback + double-click guard + error mapping.
     *
     * - Double-click під час in-flight → noop (другий клік ігнорується).
     * - Optimistic update до запиту (immediate feedback).
     * - На помилку — full rollback до знятого snapshot.
     * - Mapping known errors: 423 thread_locked/hidden/terminal, 429 rate_limit.
     */
    async toggleVote(threadId) {
      // Double-click guard
      if (this._votingInflight.has(threadId)) {
        return { skipped: 'inflight' }
      }
      const t = this.threadsById[threadId]
      if (!t) {
        // Без cached thread — fallback на raw backend call (no optimistic).
        return api.toggleVote(threadId)
      }

      // Snapshot для rollback
      const prevVoted = !!t.voted_by_me
      const prevCount = t.vote_count || 0

      // Optimistic update
      const nextVoted = !prevVoted
      const nextCount = Math.max(0, prevCount + (nextVoted ? 1 : -1))
      this._upsertThread({ ...t, voted_by_me: nextVoted, vote_count: nextCount })

      this._votingInflight.add(threadId)
      this.voteError = null

      try {
        const result = await api.toggleVote(threadId)
        // Reconcile with authoritative server response
        const cur = this.threadsById[threadId]
        if (cur) {
          this._upsertThread({
            ...cur,
            vote_count: result.vote_count,
            voted_by_me: result.voted_by_me,
          })
        }
        return result
      } catch (err) {
        // Rollback
        const cur = this.threadsById[threadId]
        if (cur) {
          this._upsertThread({
            ...cur,
            voted_by_me: prevVoted,
            vote_count: prevCount,
          })
        }
        // Map known errors
        const status = err?.response?.status
        const code = err?.response?.data?.error
        if (status === 423) {
          if (code === 'thread_terminal') {
            this.voteError = 'feedback.vote.errors.terminal'
          } else if (code === 'thread_hidden') {
            this.voteError = 'feedback.vote.errors.hidden'
          } else {
            this.voteError = 'feedback.vote.errors.locked'
          }
        } else if (status === 429) {
          this.voteError = 'feedback.vote.errors.rateLimit'
        } else {
          this.voteError = 'feedback.vote.errors.generic'
        }
        throw err
      } finally {
        this._votingInflight.delete(threadId)
      }
    },

    isVoteInflight(threadId) {
      return this._votingInflight.has(threadId)
    },

    async subscribe(threadId) {
      await api.subscribe(threadId)
      const t = this.threadsById[threadId]
      if (t) this._upsertThread({ ...t, subscribed_by_me: true })
    },

    async unsubscribe(threadId) {
      await api.unsubscribe(threadId)
      const t = this.threadsById[threadId]
      if (t) this._upsertThread({ ...t, subscribed_by_me: false })
    },

    async loadComments(threadId) {
      // A4.1 + B5: paginated, LRU-tracked.
      const res = await api.listComments(threadId)
      // api.listComments повертає plain array (envelope unwrap). Якщо у backend
      // вже додано pagination з {data, meta} envelope, треба буде підлаштувати.
      const comments = Array.isArray(res) ? res : (res?.data ?? [])
      this.commentsByThread = { ...this.commentsByThread, [threadId]: comments }
      this._trackCommentsAccess(threadId)
      return comments
    },

    async createComment(threadId, content) {
      const c = await api.createComment(threadId, content)
      const list = this.commentsByThread[threadId] || []
      this.commentsByThread = { ...this.commentsByThread, [threadId]: [...list, c] }
      this._trackCommentsAccess(threadId)
      // bump comment_count
      const t = this.threadsById[threadId]
      if (t) this._upsertThread({ ...t, comment_count: (t.comment_count || 0) + 1 })
      return c
    },

    async deleteComment(commentId, threadId) {
      await api.deleteComment(commentId)
      const list = this.commentsByThread[threadId] || []
      this.commentsByThread = {
        ...this.commentsByThread,
        [threadId]: list.filter((c) => c.id !== commentId),
      }
      const t = this.threadsById[threadId]
      if (t) this._upsertThread({ ...t, comment_count: Math.max(0, (t.comment_count || 1) - 1) })
    },

    /**
     * B5: явний reset (опційно — викликається на logout або memory pressure).
     */
    resetCache() {
      this.threadsById = {}
      this._threadOrder = []
      this.commentsByThread = {}
      this._commentsOrder = []
      this.listIds = []
      this.similarResults = []
    },

    async searchSimilar(q, opts = {}) {
      this.similarLoading = true
      try {
        const results = await api.searchSimilar(q, opts)
        this.similarResults = results
        return results
      } finally {
        this.similarLoading = false
      }
    },

    clearSimilar() {
      this.similarResults = []
    },

    // ---------- Staff actions ----------
    async changeStatus(threadId, payload) {
      const t = await api.changeStatus(threadId, payload)
      this._upsertThread(t)
      return t
    },

    async updateStaffResponse(threadId, response) {
      const t = await api.updateStaffResponse(threadId, response)
      this._upsertThread(t)
      return t
    },

    async toggleLock(threadId) {
      const res = await api.toggleLock(threadId)
      const t = this.threadsById[threadId]
      if (t) this._upsertThread({ ...t, is_locked: res.is_locked })
      return res
    },

    async toggleHide(threadId) {
      const res = await api.toggleHide(threadId)
      const t = this.threadsById[threadId]
      if (t) this._upsertThread({ ...t, is_hidden: res.is_hidden })
      return res
    },
  },
})
