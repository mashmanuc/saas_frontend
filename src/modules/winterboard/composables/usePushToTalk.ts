// WB Remote: «Говорю» — мікрофон слухає ЛИШЕ поки кнопку тримають.
// Ref: CLASSROOM_REMOTE_VISION_2026-09-02.md, крок 6.
//
// Навмисно НЕ useVoiceDictation: той слухає безперервно з авторестартом і пише в
// поле — правильно для чату, неправильно для класу (мікрофон ловить дітей).
// Тут: press() → одна сесія розпізнавання без continuous і без рестарту;
// release() → stop(); фінальний текст віддається подією onFinal один раз.
// Розпізнавання локальне в браузері; аудіо нікуди не зберігається.

import { ref, onBeforeUnmount } from 'vue'

const _SR =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

export interface UsePushToTalkOptions {
  lang?: string
  /** Викликається один раз на утримання, якщо щось розпізнано */
  onFinal: (text: string) => void
  /** Помилка доступу до мікрофона тощо (не «нічого не сказано») */
  onError?: (code: string) => void
}

export function usePushToTalk(opts: UsePushToTalkOptions) {
  const supported = !!_SR
  const listening = ref(false)

  let recognition: any = null
  let finalText = ''
  let delivered = false

  function ensure() {
    if (recognition || !_SR) return recognition
    recognition = new _SR()
    recognition.lang = opts.lang || 'uk-UA'
    recognition.interimResults = false
    recognition.continuous = false      // одна фраза на утримання
    recognition.maxAlternatives = 1
    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText = (finalText + ' ' + res[0].transcript).trim()
      }
    }
    recognition.onend = () => {
      listening.value = false
      if (!delivered && finalText) {
        delivered = true
        opts.onFinal(finalText)
      }
    }
    recognition.onerror = (ev: any) => {
      // no-speech / aborted — штатно (просто нічого не сказали); решта — назовні
      if (ev?.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
        opts.onError?.(String(ev.error))
      }
    }
    return recognition
  }

  /** Кнопку натиснули — почати слухати. Повторний press під час слухання — no-op. */
  function press(): void {
    const r = ensure()
    if (!r || listening.value) return
    finalText = ''
    delivered = false
    try {
      r.start()
      listening.value = true
    } catch {
      listening.value = false
    }
  }

  /** Кнопку відпустили — зупинити; фінальний результат прийде в onend. */
  function release(): void {
    if (!recognition || !listening.value) return
    try { recognition.stop() } catch { /* already stopped */ }
  }

  onBeforeUnmount(() => {
    try { recognition && recognition.abort?.() } catch { /* noop */ }
  })

  return { supported, listening, press, release }
}
