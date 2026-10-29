// Диктант на пульті (LAW §9 v1.70): натиснув «Говорити» — телефон слухає ФРАЗА ЗА ФРАЗОЮ, доки не натиснеш «Зупинити».
//
// Чому не `useVoiceDictation` (v1.69): той слухає безперервно (`continuous` + проміжні результати). 29.10 власник: на його
// телефоні (Android) у диктанті мікрофон не працює, а в пошуку відео — працює. Відео слухає `usePushToTalk`: одна сесія
// без `continuous` і без проміжних результатів. Тут — рівно ті самі налаштування сесії, лише після кожної фрази телефон
// сам починає нову, тож паузи не зупиняють диктант (як і обіцяє вікно).
//
// Тиша не мовчить: якщо телефон відмовив (мікрофон, зв'язок, мова) або сесії обриваються одразу, не почувши нічого,
// диктант зупиняється з причиною (`onFinish(text, reason)`), а сказане до того не губиться. Звук не залишає телефона.

import { ref, onBeforeUnmount } from 'vue'

const _SR =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

/** Відмови, після яких слухати далі марно — зупиняємося й кажемо чому. */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported', 'bad-grammar'])
/** Сесія, що скінчилась швидше й без жодного слова, — телефон не слухає (а не людина мовчить: тиша триває секунди). */
export const QUICK_END_MS = 1000
/** Стільки таких сесій поспіль — і зупинка з причиною, а не нескінченні перезапуски. */
export const MAX_QUICK_ENDS = 3
/** Пауза між сесіями: старт одразу після кінця телефон може відкинути як «зайнятий». */
export const RESTART_DELAY_MS = 300
/** Після «Зупинити» останню фразу телефон віддає в `onend`; не прийшов за цей час — закінчуємо з тим, що є. */
export const STOP_WAIT_MS = 3000

export interface PhraseDictationOptions {
  /** v1.73: кожна почута фраза — одразу, щойно телефон її віддав (поле на телефоні наповнюється під час диктування). */
  onPhrase?: (phrase: string) => void
  /**
   * Рівно раз на кожен `start`: увесь сказаний текст і причина зупинки
   * (`null` — зупинив учитель; інакше код відмови телефона або `stopped_listening` / `start_failed`).
   */
  onFinish: (text: string, reason: string | null) => void
}

export function usePhraseDictation(opts: PhraseDictationOptions) {
  const supported = !!_SR
  /** Від «Говорити» до кінця останньої фрази після «Зупинити». */
  const listening = ref(false)
  /** Сказане в цьому диктанті (усі почуті фрази). */
  const text = ref('')

  let recognition: any = null
  let active = false            // учитель ще не натиснув «Зупинити» і телефон не відмовив
  let finished = true           // onFinish для поточного start уже викликано
  let running = false           // сесія телефона йде (між start і onend)
  let sessionText = ''
  let sessionStart = 0
  let sessionError = ''
  let fatal = ''
  let quickEnds = 0
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let stopTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimers() {
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  }

  function finish(reason: string | null) {
    if (finished) return
    finished = true
    active = false
    clearTimers()
    listening.value = false
    opts.onFinish(text.value, reason)
  }

  function startSession() {
    sessionText = ''
    sessionError = ''
    sessionStart = Date.now()
    try {
      recognition.start()
      running = true
    } catch {
      running = false
      finish('start_failed')
    }
  }

  function ensure() {
    if (recognition || !_SR) return recognition
    recognition = new _SR()
    recognition.interimResults = false   // як у відео: лише готова фраза
    recognition.continuous = false       // одна фраза на сесію; далі — нова сесія
    recognition.maxAlternatives = 1
    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) sessionText = `${sessionText} ${res[0]?.transcript ?? ''}`.trim()
      }
    }
    recognition.onerror = (ev: any) => {
      const code = String(ev?.error || 'unknown')
      sessionError = code
      if (FATAL.has(code)) fatal = code
    }
    recognition.onend = () => {
      running = false
      if (finished) return
      if (sessionText) {
        text.value = `${text.value} ${sessionText}`.trim()
        quickEnds = 0
        opts.onPhrase?.(sessionText)
      }
      if (!active) { finish(null); return }
      if (fatal) { finish(fatal); return }
      const quick = !sessionText && Date.now() - sessionStart < QUICK_END_MS
      quickEnds = quick ? quickEnds + 1 : 0
      if (quickEnds >= MAX_QUICK_ENDS) { finish(sessionError || 'stopped_listening'); return }
      restartTimer = setTimeout(() => {
        restartTimer = null
        if (active && !finished) startSession()
      }, RESTART_DELAY_MS)
    }
    return recognition
  }

  /** «Говорити»: новий диктант мовою `lang` (`uk-UA` | `en-GB`). Поки слухає — no-op. */
  function start(lang: string) {
    const r = ensure()
    if (!r || listening.value) return
    r.lang = lang
    text.value = ''
    fatal = ''
    quickEnds = 0
    active = true
    finished = false
    listening.value = true
    startSession()
  }

  /** «Зупинити»: остання фраза прийде в `onend`, тоді — `onFinish(text, null)`. */
  function stop() {
    if (finished || !active) return
    active = false
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
    if (!running) { finish(null); return }   // між фразами — чекати нічого
    try { recognition.stop() } catch { /* уже зупинено — onend прийде або спрацює таймер */ }
    stopTimer = setTimeout(() => finish(null), STOP_WAIT_MS)
  }

  onBeforeUnmount(() => {
    active = false
    finished = true
    clearTimers()
    try { recognition && recognition.abort?.() } catch { /* noop */ }
  })

  return { supported, listening, text, start, stop }
}
