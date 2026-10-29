/**
 * Програми навчання — клієнт серверного контракту lp.v1 / gen.v1
 * (`saas_docs/domains/learning_program/CONTRACT_LEARNING_PROGRAMS_API_V1_2026-10-27.md`).
 *
 * Сервер віддає 404 на все, якщо вчитель поза пілотом `LEARNING_PROGRAMS_USER_IDS` — екрани й меню тоді не
 * показуються (`useProgramsAvailability`). Команди з побічним ефектом несуть `Idempotency-Key` / `event_id` /
 * `request_id`, щоб повтор не дублював запис; стара вкладка отримує 409 `revision_conflict`.
 */
import api from '@/utils/apiClient'

const BASE = '/v1/learning-programs'

export interface Ref { provider: string; id: string }
export interface Learner { id: number; display_name: string; has_account: boolean }

export interface ProgramListItem {
  id: string
  route_revision: number
  title: string
  status: 'draft' | 'active' | 'paused' | 'done' | 'archived'
  target: { kind: 'learner' | 'group'; learner: Learner | null; participants_count: number }
  goal: { kind: string; label_key: string } | null
  current: { lesson_id: string; position: number; title: string } | null
  next_session: { calendar_ref: Ref; starts_at: string } | null
  attention: { reason_key: string; lesson_id?: string }[]
}

export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }

export interface ProgramItem {
  item_id: string
  order: number
  title: string
  scope: string
  state: 'done' | 'now' | 'next' | 'skipped' | 'deferred' | string
  deferred_reason_key: string | null
}

export interface ProgramMaterial {
  state: string
  request_id: string
  material_ref: Ref
  open: Ref
  prepared_at: string
  test_adapter: boolean
}

export interface ProgramLesson {
  lesson_id: string
  position: number
  item_id: string | null
  title: string
  role: string
  unit_refs?: string[]
  plan_state: string
  preparation_state: string
  credit_state: 'credited' | 'open' | 'repeat_needed' | string
  needs_confirmation: boolean
  calendar_ref: Ref | null
  source_conflict: unknown
  material: ProgramMaterial | null
}

export interface Participant {
  participant_id: string
  learner: Learner
  joined_at: string
  left_at: string | null
}

export interface ProgramDetail {
  id: string
  route_revision: number
  title: string
  status: string
  template: { id: string; code: string; version: string; adapter: string }
  target: { kind: 'learner' | 'group'; group_ref: Ref | null; participants: Participant[] }
  level: { scale: string; ordinal: number } | null
  pace: string
  goal: { kind: string; label_key: string; target_date: string | null; target_score: number | null } | null
  summary: {
    last: { lesson_id: string; title: string; occurred_at: string; attendance: string; pedagogical_action: string } | null
    today: { lesson_id: string; title: string; needs_confirmation: boolean; calendar_ref: Ref | null } | null
    next: { lesson_id: string; title: string }[]
  }
  items: ProgramItem[]
  lessons: ProgramLesson[]
  actions: string[]
  private_notes: string
}

export interface LearnerView {
  id: string
  title: string
  goal_label_key: string | null
  current_topic: string | null
  plan: { title: string; state: string }[]
  progress: { done_lessons: number; planned_lessons: number }
  next_steps: { title: string }[]
  materials: { title: string; kind: string; open: Ref }[]
}

export interface TemplateVersion {
  id: string
  code: string
  version: string
  status: string
  adapter: string
  labels: Record<string, string>
  title: string
}

export interface Capabilities {
  status: 'available' | 'not_ready' | 'unsupported'
  reason_key: string | null
  level: { kind: 'named_scale'; codes: string[]; default: string } | null
  volume: { kind: 'count'; min: number; max: number; default: number } | null
}

export interface GenerationPreview {
  can_prepare: boolean
  context: { unit_refs: string[]; role: string; route_revision: number }
  shortage: { requested: number | null; available: number | null }[]
  warnings: { reason_key: string; detail?: string }[]
}

export interface PreparationStatus {
  request_id: string
  status: 'requested' | 'prepared' | 'failed' | 'replaced'
  reason_key: string | null
  material_ref: Ref | null
  shortage: { requested: number | null; available: number | null }[]
}

export interface MaterialUse { material_ref: Ref; usage: 'whole' | 'partial' | 'unknown'; content_refs_used: Ref[] }

export type PedagogicalAction = 'next' | 'repeat' | 'none'

export interface OutcomeInput {
  attendance: 'held' | 'not_held'
  action: PedagogicalAction
  materials?: MaterialUse[]
  /** Урок розкладу: тоді відвідування сервер звіряє з розкладом (`booking.event`). */
  calendarRef?: Ref | null
}

/**
 * Тіла команд складаються ОДИН раз на намір (ключ усередині тіла або поруч) і надсилаються як є — повтор після
 * втраченої відповіді має бути байт-у-байт тим самим запитом (сервер звіряє хеш тіла). Див. `intent.ts`.
 */
export const bodies = {
  create(o: { template_version_id: string; learnerId: number; level: number | null; status: 'draft' | 'active' }) {
    return {
      template_version_id: o.template_version_id,
      target: { kind: 'learner', learner_id: o.learnerId, learner_ids: null, group_ref: null },
      title_override: null,
      level: o.level ? { ordinal: o.level } : null,
      pace: '1.00',
      goal: null,
      status: o.status,
    }
  },
  /** Підсумок заняття індивідуальної програми: один учасник, його список = список події (контракт §3.1). */
  outcome(p: ProgramDetail, lessonId: string, o: OutcomeInput, eventId: string) {
    const credited = o.attendance === 'held' && o.action === 'next' ? [lessonId] : []
    const action = o.attendance === 'held' ? o.action : 'none'
    const part = p.target.participants.find((x) => !x.left_at) ?? p.target.participants[0]
    return {
      event_id: eventId,
      schema_version: 1,
      kind: 'outcome',
      expected_revision: p.route_revision,
      occurred_at: new Date().toISOString(),
      calendar_ref: o.calendarRef ?? null,
      attendance: o.attendance,
      pedagogical_action: action,
      credited_lesson_ids: credited,
      participant_outcomes: [{
        participant_id: part.participant_id, attendance: o.attendance, personal_action: action,
        personal_credited_lesson_ids: credited, needs_catch_up: false,
      }],
      materials_used: o.attendance === 'held' ? (o.materials ?? []) : [],
      corrects_event_id: null,
      correction_reason: null,
    }
  },
  /** «Ще раз»: заняття-повторення після цього заняття (нічого не генерує й не зараховує). */
  addReview(p: ProgramDetail, afterLessonId: string, unitRefs: string[]) {
    return { kind: 'add_review', expected_revision: p.route_revision,
      payload: { after_lesson_id: afterLessonId, lessons: 1, review_unit_refs: unitRefs } }
  },
  /** «Повернути в план» пройдену тему (2026-10-29): новий запис історії, нічого не стирається. */
  reopen(p: ProgramDetail, eventId: string) {
    return { event_id: eventId, expected_revision: p.route_revision }
  },
  /** Скасувати повернення — корекція саме того запису. */
  undoReopen(p: ProgramDetail, reopenEventId: string, eventId: string) {
    return { event_id: eventId, expected_revision: p.route_revision, reopen_event_id: reopenEventId }
  },
  setLevel(p: ProgramDetail, ordinal: number) {
    return { kind: 'set_level', expected_revision: p.route_revision,
      payload: { level: { ordinal }, scope: 'program', item_id: null } }
  },
  setPace(p: ProgramDetail, pace: string) {
    return { kind: 'set_pace', expected_revision: p.route_revision, payload: { pace } }
  },
  prepare(p: ProgramDetail, profile: string, count: number, requestId: string) {
    return {
      request_id: requestId, level_selection: { code: profile }, volume_selection: { kind: 'count', value: count },
      review: { intentional_review: false, review_reason: null }, expected_revision: p.route_revision,
    }
  },
}

const withKey = (key: string) => ({ headers: { 'Idempotency-Key': key } })

export const learningProgramsApi = {
  list(params: { status?: string; q?: string; learner?: number } = {}): Promise<Page<ProgramListItem>> {
    return api.get(`${BASE}/`, { params })
  },
  detail(id: string): Promise<ProgramDetail> {
    return api.get(`${BASE}/${id}/`)
  },
  learnerView(id: string): Promise<LearnerView> {
    return api.get(`${BASE}/${id}/learner-view/`)
  },
  forBoard(boardId: string): Promise<{ board_learner: Learner | null; programs: { id: string; title: string; status: string }[] }> {
    return api.get(`${BASE}/for-board/`, { params: { board: boardId } })
  },
  templates(): Promise<TemplateVersion[]> {
    return api.get('/v1/learning-program-templates/')
  },
  create(body: ReturnType<typeof bodies.create>, key: string): Promise<ProgramDetail> {
    return api.post(`${BASE}/`, body, withKey(key))
  },
  // «Видалити програму» — архів: зі списків і з дошки зникає, історія учня на сервері лишається.
  archive(p: ProgramDetail): Promise<ProgramDetail> {
    return api.patch(`${BASE}/${p.id}/`, { expected_revision: p.route_revision, status: 'archived' })
  },
  sendOutcome(programId: string, lessonId: string, body: ReturnType<typeof bodies.outcome>):
    Promise<{ route_revision: number; replayed: boolean }> {
    return api.post(`${BASE}/${programId}/lessons/${lessonId}/outcome/`, body)
  },
  sendReopen(programId: string, lessonId: string, body: ReturnType<typeof bodies.reopen>):
    Promise<{ route_revision: number; replayed: boolean; event: { event_id: string } }> {
    return api.post(`${BASE}/${programId}/lessons/${lessonId}/reopen/`, body)
  },
  sendUndoReopen(programId: string, lessonId: string, body: ReturnType<typeof bodies.undoReopen>):
    Promise<{ route_revision: number; replayed: boolean }> {
    return api.post(`${BASE}/${programId}/lessons/${lessonId}/reopen/undo/`, body)
  },
  sendProposal(programId: string, body: object, key: string): Promise<{ route_revision: number; replayed: boolean }> {
    return api.post(`${BASE}/${programId}/proposals/`, body, withKey(key))
  },
  capabilities(programId: string, lessonId: string): Promise<Capabilities> {
    return api.get(`${BASE}/${programId}/lessons/${lessonId}/generation/capabilities/`)
  },
  previewGeneration(programId: string, lessonId: string, profile: string, count: number): Promise<GenerationPreview> {
    return api.post(`${BASE}/${programId}/lessons/${lessonId}/generation/preview/`, {
      level_selection: { code: profile }, volume_selection: { kind: 'count', value: count },
      review: { intentional_review: false, review_reason: null },
    })
  },
  sendPrepare(programId: string, lessonId: string, body: ReturnType<typeof bodies.prepare>):
    Promise<{ request_id: string; status: string }> {
    return api.post(`${BASE}/${programId}/lessons/${lessonId}/preparations/`, body)
  },
  preparation(requestId: string): Promise<PreparationStatus> {
    return api.get(`${BASE}/preparations/${requestId}/`)
  },
}

/** Посилання «Відкрити» матеріалу → маршрут сайту. Невідомий постачальник — null (кнопки не показуємо). */
export function materialRoute(open: Ref | null | undefined) {
  if (open?.provider === 'winterboard.prepare' || open?.provider === 'winterboard.board') {
    return { name: 'winterboard-prepare', params: { id: open.id } }
  }
  return null
}

/** Код помилки сервера з тіла відповіді (`{error, detail}`), щоб показати зрозумілий стан. */
export function errorCode(e: unknown): string | null {
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data
  return typeof data?.error === 'string' ? data.error : null
}

export function errorStatus(e: unknown): number | null {
  const s = (e as { response?: { status?: number } })?.response?.status
  return typeof s === 'number' ? s : null
}
