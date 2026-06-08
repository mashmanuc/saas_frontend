// useCreateFromPdf — "Створити урок з PDF" flow
// Orchestrates: create KnowledgeLesson + WBSession → upload PDF → poll → navigate.
// Ref: MANIFEST §3.2.1 (Limits UX Layer: VISIBLE/PREDICTABLE/EXPLAINABLE)
// Ref: WBPdfService (backend) — MAX_PDF_PAGES=50, MAX_PDF_SIZE_MB=50

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../api/winterboardApi'

// Must match backend WBPdfService constants
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 300_000 // 5 min

export function useCreateFromPdf() {
  const router = useRouter()
  const { t } = useI18n()

  const isCreating = ref(false)
  const progress = ref(0) // 0–100
  const error = ref<string | null>(null)

  // Abort flag — lets the caller stop the poll loop when the component unmounts
  // or the user navigates away. Without it the 2s poll loop keeps running in the
  // background until the timeout, which is the root cause of the duplicate
  // /import-pdf/ requests seen when re-entering the studio mid-import.
  let cancelled = false

  function cancel(): void {
    cancelled = true
    isCreating.value = false
    progress.value = 0
  }

  /**
   * Map any failure from the create-from-PDF flow to a clear, localized message.
   * The backend returns `{ error: "<reason>" }` on 400 (bad/oversized/too-many-pages/
   * encrypted PDF); axios otherwise surfaces only "Request failed with status code N",
   * which is meaningless to a user. We translate the known reasons and, as a last
   * resort, fall back to a friendly generic — never the raw axios string.
   */
  function toFriendlyError(err: unknown): string {
    const E = 'winterboard.createFromPdf.error'
    const resp = (err as { response?: { status?: number; data?: { error?: unknown; detail?: unknown } } })?.response
    const httpStatus = resp?.status
    const data = resp?.data

    // The backend error field may be a string OR an object { code, detail }
    // (some throttle / validation responses). Extract a string SAFELY — calling
    // .toLowerCase() on a non-string throws "toLowerCase is not a function" and
    // kills the catch handler (same guard as useImageUpload.classify429).
    let reason = ''
    const rawError = data?.error
    if (typeof rawError === 'string') {
      reason = rawError
    } else if (rawError && typeof rawError === 'object') {
      const o = rawError as { detail?: unknown; code?: unknown }
      reason = String(o.detail ?? o.code ?? '')
    }
    if (!reason && typeof data?.detail === 'string') reason = data.detail
    if (!reason && err instanceof Error) reason = err.message
    const m = reason.toLowerCase()

    if (httpStatus === 429 || m.includes('throttled') || m.includes('too many request')) return t(`${E}.rateLimited`)
    if (httpStatus === 413 || m.includes('too large') || m.includes('занадто велик')) return t(`${E}.tooLarge`)
    if (m.includes('too many pages')) return t(`${E}.tooManyPages`)
    if (m.includes('encrypt') || m.includes('password')) return t(`${E}.encrypted`)
    if (
      m.includes('content type') || m.includes('invalid pdf') || m.includes('pdf format')
      || m.includes('not a pdf') || m.includes('no pages') || m.includes('empty') || m.includes('no file')
    ) {
      return t(`${E}.invalidPdf`)
    }
    if (m.includes('timed out') || m.includes('timeout')) return t(`${E}.timeout`)
    if (
      m.includes('unavailable') || m.includes('did not start')
      || (typeof httpStatus === 'number' && httpStatus >= 500)
    ) {
      return t(`${E}.serverError`)
    }
    // A message we threw ourselves inside the flow is already localized — show it,
    // but NEVER surface the raw axios "Request failed with status code N".
    if (reason && !m.startsWith('request failed')) return reason
    return t(`${E}.processing`)
  }

  async function createFromPdf(file: File): Promise<void> {
    if (isCreating.value) return

    // MANIFEST §3.2.1 EXPLAINABLE: FE guard before network call
    if (file.size > MAX_PDF_SIZE_BYTES) {
      error.value = t('winterboard.createFromPdf.error.tooLarge')
      return
    }

    isCreating.value = true
    error.value = null
    progress.value = 5
    cancelled = false

    // The draft board is created BEFORE the import can be confirmed (the import
    // endpoint needs a session to import into). Track it so we can remove the
    // empty orphan if the import is rejected (e.g. a 128-page збірник → 400
    // "too many pages").
    let createdSessionId: string | null = null

    try {
      // Step 1: create KnowledgeLesson + WBSession (same path as "Нова дошка")
      const { lessonViewApi } = await import('@/modules/knowledge/api/lessonViewApi')
      const title = file.name.replace(/\.pdf$/i, '')
      const { wb_session_id } = await lessonViewApi.createDraftWithPrep(title)
      createdSessionId = wb_session_id
      progress.value = 20

      // Step 2: upload PDF → Celery task
      const { task_id } = await winterboardApi.importPdf(wb_session_id, file)
      progress.value = 35

      // Step 3: poll until backend renders all pages to PNG
      // setTimeout here is legitimate network polling, not a logical-error workaround
      const deadline = Date.now() + POLL_TIMEOUT_MS
      while (Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        if (cancelled) return
        const status = await winterboardApi.getImportStatus(wb_session_id, task_id)
        if (cancelled) return

        if (status.status === 'done') {
          progress.value = 100
          await router.push({ name: 'winterboard-prepare', params: { id: wb_session_id } })
          return
        }

        if (status.status === 'failed') {
          throw new Error(status.error ?? t('winterboard.createFromPdf.error.processing'))
        }

        // Smoothly advance 35→90 while Celery processes pages
        if (progress.value < 90) progress.value = Math.min(90, progress.value + 3)
      }

      throw new Error(t('winterboard.createFromPdf.error.timeout'))
    } catch (err) {
      error.value = toFriendlyError(err)
      // Import failed → the draft board we created in Step 1 is now an empty
      // orphan in the studio. Remove it (best-effort) so the failure is clean.
      if (createdSessionId) {
        winterboardApi.deleteSession(createdSessionId).catch((delErr) => {
          console.warn('[WB:createFromPdf] orphan board cleanup failed', delErr)
        })
      }
    } finally {
      isCreating.value = false
      if (error.value) progress.value = 0
    }
  }

  return { isCreating, progress, error, createFromPdf, cancel }
}
