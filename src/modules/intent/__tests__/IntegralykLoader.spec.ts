// Великий лодер «Інтегралик думає» (власник 2026-10-20: «підбери нового лодера — інтегралик думає»).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import IntegralykLoader from '../IntegralykLoader.vue'

const look = ref<'integralyk' | 'integralka'>('integralyk')
vi.mock('../assistantLook', () => ({ useAssistantLook: () => ({ look }) }))

describe('IntegralykLoader', () => {
  it('сцена «хмарка думок» з нашим персонажем усередині: бульбашки, хмарка, фігури, лампочка', () => {
    const w = mount(IntegralykLoader)
    const html = w.html()
    expect(html).toContain('class="itl-mascot"')
    expect(html).toContain('itg-body')                 // персонаж — наш малюнок, не копія з вихідника
    for (const part of ['itl-dot1', 'itl-dot2', 'itl-cloud', 'itl-bulb', 'itl-rays']) expect(html).toContain(part)
    expect(w.findAll('.itl-sym')).toHaveLength(4)
    expect(w.attributes('role')).toBe('status')
    expect(w.attributes('style')).toContain('width: 180px')
  })

  it('вигляд і кольори сцени — за вибором користувача (Інтегралка — малинова)', () => {
    look.value = 'integralka'
    const html = mount(IntegralykLoader, { props: { width: 120 } }).html()
    expect(html).toContain('itg-bow')
    expect(html).toContain('stroke="#f9738d"')
    expect(html).not.toContain('stroke="#0d9488" stroke-width="2.5"')
    look.value = 'integralyk'
  })
})
