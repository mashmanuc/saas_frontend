/**
 * Ключі причин сервера (`reason_key`, код помилки) → текст для вчителя. Невідомий ключ — загальний текст,
 * без показу службового коду.
 */
type T = (key: string, values?: Record<string, unknown>) => string
type TE = (key: string) => boolean

const MAP: Record<string, string> = {
  'adapter.not_enabled': 'learningPrograms.reasons.notEnabled',
  'adapter.topics_not_mapped': 'learningPrograms.reasons.topicNotMapped',
  'lesson.topic_not_mapped': 'learningPrograms.reasons.topicNotMapped',
  'lesson.manual_scenario': 'learningPrograms.reasons.manualScenario',
  'lesson.needs_learner_context': 'learningPrograms.reasons.needsLearnerContext',
  context_changed: 'learningPrograms.reasons.contextChanged',
  learner_not_active: 'learningPrograms.errors.learnerNotActive',
  revision_conflict: 'learningPrograms.errors.revisionConflict',
  adapter_unsupported: 'learningPrograms.reasons.topicNotMapped',
}

export function reasonKeyText(key: string | null | undefined, t: T, te: TE): string {
  const k = key ? MAP[key] : undefined
  return k && te(k) ? t(k) : t('learningPrograms.errors.generic')
}
