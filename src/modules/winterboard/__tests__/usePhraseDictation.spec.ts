// LAW §9 v1.70 · диктант на пульті слухає фраза за фразою (власник 2026-10-29: на його Android у диктанті мікрофон
// мовчить, у пошуку відео — працює). Перевіряємо рушій на підробленому розпізнавачі телефона: налаштування як у відео,
// фрази накопичуються через паузи, «Зупинити» не губить останньої фрази, відмова й «телефон не слухає» — з причиною.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

class FakeRecognition {
  static last: FakeRecognition | null = null
  static failStart = false
  lang = ''
  continuous: boolean | null = null
  interimResults: boolean | null = null
  maxAlternatives = 0
  starts = 0
  running = false
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  constructor() { FakeRecognition.last = this }
  start() {
    if (FakeRecognition.failStart || this.running) throw new Error('InvalidStateError')
    this.starts++
    this.running = true
  }
  stop() { /* фінал приходить у тесті через say()/end() */ }
  abort() { this.running = false }
  // телефон почув фразу: фінальний результат і кінець сесії
  say(text: string) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: true })] })
    this.end()
  }
  fail(code: string) { this.onerror?.({ error: code }); this.end() }
  end() { this.running = false; this.onend?.() }
}

async function setup() {
  vi.resetModules()
  ;(window as any).webkitSpeechRecognition = FakeRecognition
  const mod = await import('../composables/usePhraseDictation')
  const finished: Array<{ text: string; reason: string | null }> = []
  let api: ReturnType<typeof mod.usePhraseDictation> | null = null
  const C = defineComponent({
    setup() {
      api = mod.usePhraseDictation({ onFinish: (text, reason) => finished.push({ text, reason }) })
      return () => h('div')
    },
  })
  const w = mount(C)
  return { mod, api: api!, finished, w, rec: () => FakeRecognition.last! }
}

describe('usePhraseDictation — диктант фраза за фразою', () => {
  beforeEach(() => { vi.useFakeTimers(); FakeRecognition.last = null })
  afterEach(() => { vi.useRealTimers(); delete (window as any).webkitSpeechRecognition })

  it('налаштування сесії — як у пошуку відео: без continuous і без проміжних результатів', async () => {
    const { api, rec } = await setup()
    api.start('uk-UA')
    expect(rec().continuous).toBe(false)
    expect(rec().interimResults).toBe(false)
    expect(rec().lang).toBe('uk-UA')
    expect(api.listening.value).toBe(true)
  })

  it('паузи не зупиняють: після кожної фрази — нова сесія, фрази складаються', async () => {
    const { mod, api, rec, finished } = await setup()
    api.start('uk-UA')
    rec().say('Сонце сходило')
    vi.advanceTimersByTime(mod.RESTART_DELAY_MS)
    expect(rec().starts).toBe(2)
    // довга тиша: телефон за кілька секунд каже «нічого не почув» — це не поломка
    vi.advanceTimersByTime(5000)
    rec().fail('no-speech')
    vi.advanceTimersByTime(mod.RESTART_DELAY_MS)
    expect(rec().starts).toBe(3)
    rec().say('птахи співали')
    expect(api.text.value).toBe('Сонце сходило птахи співали')
    expect(api.listening.value).toBe(true)
    expect(finished).toEqual([])
  })

  it('«Зупинити» посеред фрази — остання фраза не губиться, onFinish рівно раз без причини', async () => {
    const { api, rec, finished } = await setup()
    api.start('uk-UA')
    rec().say('Класна робота')
    vi.advanceTimersByTime(400)
    api.stop()
    expect(api.listening.value).toBe(true)        // чекаємо останню фразу від телефона
    rec().say('Диктант')
    expect(finished).toEqual([{ text: 'Класна робота Диктант', reason: null }])
    expect(api.listening.value).toBe(false)
    vi.advanceTimersByTime(10000)
    expect(finished).toHaveLength(1)
    expect(rec().starts).toBe(2)                  // після «Зупинити» нових сесій немає
  })

  it('«Зупинити» між фразами — одразу, без очікування', async () => {
    const { api, rec, finished } = await setup()
    api.start('en-GB')
    rec().say('Hello')
    api.stop()                                     // сесія вже скінчилась, нова ще не почалась
    expect(finished).toEqual([{ text: 'Hello', reason: null }])
    vi.advanceTimersByTime(1000)
    expect(rec().starts).toBe(1)
  })

  it('телефон не віддав останню фразу після «Зупинити» — за 3 с закінчуємо з тим, що є', async () => {
    const { mod, api, rec, finished } = await setup()
    api.start('uk-UA')
    rec().say('Перше')
    vi.advanceTimersByTime(400)
    api.stop()
    vi.advanceTimersByTime(mod.STOP_WAIT_MS)
    expect(finished).toEqual([{ text: 'Перше', reason: null }])
    rec().end()                                    // пізній кінець — уже нікуди
    expect(finished).toHaveLength(1)
  })

  it('мікрофон заборонено — зупинка з причиною, сказане лишається', async () => {
    const { api, rec, finished } = await setup()
    api.start('uk-UA')
    rec().say('Сонце')
    vi.advanceTimersByTime(400)
    rec().fail('not-allowed')
    expect(finished).toEqual([{ text: 'Сонце', reason: 'not-allowed' }])
    expect(api.listening.value).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(rec().starts).toBe(2)
  })

  it('сесії обриваються одразу, нічого не почувши, — після трьох поспіль зупинка з причиною, а не вічні перезапуски', async () => {
    const { mod, api, rec, finished } = await setup()
    api.start('uk-UA')
    for (let i = 0; i < mod.MAX_QUICK_ENDS; i++) {
      rec().fail('aborted')
      vi.advanceTimersByTime(mod.RESTART_DELAY_MS)
    }
    expect(finished).toEqual([{ text: '', reason: 'aborted' }])
    expect(rec().starts).toBe(mod.MAX_QUICK_ENDS)
    expect(api.listening.value).toBe(false)
  })

  it('швидкий обрив між нормальними фразами не накопичується — лічильник скидається почутою фразою', async () => {
    const { mod, api, rec, finished } = await setup()
    api.start('uk-UA')
    for (let round = 0; round < 3; round++) {
      rec().fail('aborted')
      vi.advanceTimersByTime(mod.RESTART_DELAY_MS)
      rec().fail('aborted')
      vi.advanceTimersByTime(mod.RESTART_DELAY_MS)
      rec().say(`фраза ${round}`)
      vi.advanceTimersByTime(mod.RESTART_DELAY_MS)
    }
    expect(finished).toEqual([])
    expect(api.text.value).toBe('фраза 0 фраза 1 фраза 2')
  })

  it('телефон не дав почати — одразу причина', async () => {
    const { api, finished } = await setup()
    FakeRecognition.failStart = true
    try {
      api.start('uk-UA')
    } finally {
      FakeRecognition.failStart = false
    }
    expect(finished).toEqual([{ text: '', reason: 'start_failed' }])
    expect(api.listening.value).toBe(false)
  })
})
