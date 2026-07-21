/**
 * MathQuillField — wiring ascii↔LaTeX↔MathQuill (MathQuill-блок §0.1).
 *
 * Справжній MathQuill у happy-dom не працює (layout/jQuery) — підкладаємо
 * fake window.MathQuill; loader бачить глобал і віддає інтерфейс (та сама
 * гілка, що на проді після load). Без глобала (MODE=test) loader → null →
 * компонент емітить 'unavailable' (fallback-контракт для інспекторів).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MathQuillField from '../MathQuillField.vue'
import { __resetMathQuillLoaderForTests } from '../../../utils/mathquillLoader'

interface FakeField {
  latexValue: string
  latex: (v?: string) => string | void
  focus: () => void
  revert: () => void
}

let lastField: FakeField | null = null
let lastHandlers: { edit?: (mf: FakeField) => void; enter?: () => void } = {}

function installFakeMQ(): void {
  lastField = null
  lastHandlers = {}
  ;(window as never as { MathQuill: unknown }).MathQuill = {
    getInterface: () => ({
      MathField: (_el: HTMLElement, opts: { handlers: typeof lastHandlers }) => {
        lastHandlers = opts.handlers
        const f: FakeField = {
          latexValue: '',
          latex(v?: string) {
            if (v === undefined) return this.latexValue
            this.latexValue = v
          },
          focus: () => {},
          revert: () => {},
        }
        lastField = f
        return f
      },
    }),
  }
}

beforeEach(() => {
  __resetMathQuillLoaderForTests()
})

afterEach(() => {
  delete (window as never as { MathQuill?: unknown }).MathQuill
  __resetMathQuillLoaderForTests()
})

describe('MathQuillField — wiring', () => {
  it('init: ascii → LaTeX у поле, БЕЗ фантомного update:modelValue', async () => {
    installFakeMQ()
    const w = mount(MathQuillField, { props: { modelValue: 'x^2' } })
    await flushPromises()
    expect(lastField).not.toBeNull()
    expect(lastField!.latexValue).toBe('x^{2}')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('typing: edit-handler → latexToSrc → update:modelValue (ascii)', async () => {
    installFakeMQ()
    const w = mount(MathQuillField, { props: { modelValue: 'x^2' } })
    await flushPromises()
    lastField!.latexValue = '\\frac{1}{x}'
    lastHandlers.edit!(lastField!)
    expect(w.emitted('update:modelValue')![0]).toEqual(['((1)/(x))'])
    w.unmount()
  })

  it('enter-handler → emit enter', async () => {
    installFakeMQ()
    const w = mount(MathQuillField, { props: { modelValue: 'x^2' } })
    await flushPromises()
    lastHandlers.enter!()
    expect(w.emitted('enter')).toHaveLength(1)
    w.unmount()
  })

  it('MQ недоступний (без глобала) → emit unavailable', async () => {
    const w = mount(MathQuillField, { props: { modelValue: 'x^2' } })
    await flushPromises()
    expect(w.emitted('unavailable')).toHaveLength(1)
    w.unmount()
  })

  it('зовнішня зміна modelValue (не в фокусі) → тихий latex-апдейт без emit', async () => {
    installFakeMQ()
    const w = mount(MathQuillField, { props: { modelValue: 'x^2' } })
    await flushPromises()
    await w.setProps({ modelValue: 'sin(x)' })
    expect(lastField!.latexValue).toBe('\\sin\\left(x\\right)')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})
