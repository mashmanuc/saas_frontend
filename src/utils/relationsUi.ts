/**
 * UI helpers for Relations v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 * 
 * Політика 1: Чат відкривається тільки через урок (lesson-only)
 * Політика 4: Smart Message Button - active_lesson_id як єдиний source of truth
 */

import type { Relation } from '@/types/relations'
import { useI18n } from 'vue-i18n'

export interface MessageAction {
  to: string
  mode: 'lesson' | 'booking'
  text: string
  disabled?: boolean
}

/**
 * P0 Guard: Єдиний helper для message logic
 * active_lesson_id - єдине джерело truth для route
 * has_current_lesson/has_upcoming_lessons - тільки для тексту кнопки
 */
export function getMessageAction(relation: Relation): MessageAction {
  const { t } = useI18n()
  
  if (relation.active_lesson_id) {
    const text = relation.has_current_lesson 
      ? t('common.joinCurrentLesson')
      : t('common.openLessonChat')
    
    return {
      to: `/lessons/${relation.active_lesson_id}/chat`,
      mode: 'lesson' as const,
      text,
      disabled: !relation.can_chat
    }
  }
  
  const tutorId = relation.tutor?.id
  return {
    to: tutorId ? `/booking?tutor=${tutorId}` : '/booking',
    mode: 'booking' as const,
    text: t('common.bookLessonToChat'),
    disabled: !tutorId
  }
}

export function getMessageButtonText(relation: Relation): string {
  return getMessageAction(relation).text
}

export function canNavigateToMessage(relation: Relation): boolean {
  return getMessageAction(relation).disabled !== true
}
