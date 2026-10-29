/**
 * Власник 2026-10-18: у картці «Відкрита відповідь» не вписати дріб — поле було числовим
 * (зі стрілками), бо банк позначає всі відкриті відповіді `answer_type: number`, а серед них
 * дроби «5/3», кома «4,5», корені. Картка вписане не перевіряє — тож поле завжди текстове.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))
vi.mock('../../../composables/useStudentTutor', () => ({ useTutorRevealGate: () => ({ value: true }) }))
vi.mock('@/modules/learning-content/utils/contentRenderer', () => ({ renderTextWithLatex: (t: string) => t }))

import NmtTaskRenderer from '../components/board/objects/NmtTaskRenderer.vue'

function mountOpenAnswer(inputType?: 'number' | 'text') {
  return mount(NmtTaskRenderer, {
    props: {
      asset: {
        id: 'a1', type: 'nmt_task', x: 0, y: 0, w: 600, h: 300, rotation: 0, locked: false,
        data: { version: 1, taskType: 'open_answer', question: 'Обчисли 7/9 ÷ 7/15.', correctAnswer: '5/3',
          ...(inputType ? { inputType } : {}), showAnswer: false, showSolution: false },
      } as never,
      isSelected: false, interactive: true, isTutor: true,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'uk', messages: { uk }, missingWarn: false })], stubs: { teleport: true } },
  })
}

describe('картка «Відкрита відповідь» — поле завжди текстове', () => {
  it.each(['number', 'text', undefined] as const)('inputType=%s → звичайне текстове поле без стрілок', (inputType) => {
    const input = mountOpenAnswer(inputType).get('input.nmt-task__input')
    expect(input.attributes('type')).toBe('text')
  })

  it('дріб, кома й корінь вписуються як є', async () => {
    const w = mountOpenAnswer('number')
    const input = w.get('input.nmt-task__input')
    for (const value of ['5/3', '4,5', '-2-2√2', '1 2/3']) {
      await input.setValue(value)
      expect((input.element as HTMLInputElement).value).toBe(value)
    }
  })
})
