import i18n from '@/i18n'
import { MathContentError, prepareActions } from './contract.mjs'

const messages: Record<string, string> = {
  uk: 'Не додано: математичний матеріал не пройшов перевірку.',
  en: 'Not added: the math content failed validation.',
  ru: 'Не добавлено: математический материал не прошёл проверку.',
}

export function mathContentMessage(): string {
  return messages[i18n.global.locale.value] ?? messages.uk
}

/** Без серверного маркера зберігаємо старий шлях без змін. Змішаний план заборонено. */
export function prepareServerActions<T extends { math_contract?: number }>(actions: T[]): T[] {
  if (!actions.some((action) => action.math_contract !== undefined)) return actions
  if (actions.some((action) => action.math_contract !== 1)) throw new Error(mathContentMessage())
  try {
    return prepareActions(actions)
  } catch (error) {
    if (error instanceof MathContentError) throw new Error(mathContentMessage())
    throw error
  }
}
