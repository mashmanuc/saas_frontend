// Інтегралик, що «думає» (власник 2026-10-18) — той самий персонаж і вигляд, що вибрав користувач.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import IntegralykThinking from '../IntegralykThinking.vue'
import { previewMascotSvg } from '../integralykMascotSvg'

const look = ref<'integralyk' | 'integralka'>('integralyk')
vi.mock('../assistantLook', () => ({ useAssistantLook: () => ({ look }) }))

describe('IntegralykThinking', () => {
  it('малюнок — вибраний вигляд; без слотів настрою палітри', () => {
    look.value = 'integralka'
    const w = mount(IntegralykThinking)
    expect(w.html()).toContain(previewMascotSvg('integralka'))
    expect(w.html()).not.toContain('itg-mood')
    expect(w.attributes('aria-hidden')).toBe('true')
    look.value = 'integralyk'
  })

  it('думає за замовчуванням; thinking=false — стоїть; розмір — з пропа', () => {
    expect(mount(IntegralykThinking).classes()).toContain('itg-thinking--on')
    const still = mount(IntegralykThinking, { props: { thinking: false, size: 12 } })
    expect(still.classes()).not.toContain('itg-thinking--on')
    expect(still.attributes('style')).toContain('width: 12px')
  })
})
