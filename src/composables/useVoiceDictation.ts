import { ref, onBeforeUnmount, type Ref } from 'vue'

/**
 * Голосова диктовка (Web Speech API) як спільний клієнт вводу.
 *
 * Пише розпізнаний текст у переданий model-ref:
 *  - `continuous` + авто-рестарт після тиші → мікрофон не глухне після 1 фрази;
 *  - накопичення (`committed`) переживає авто-рестарт → раніше сказане НЕ втрачається;
 *  - старт бере поточне значення поля за базу → голос ДОПИСУЄ, а не стирає.
 *
 * Speech-to-text відбувається ЛОКАЛЬНО в браузері — нічого не летить у зовнішні сервіси
 * (на відміну від Інтегралика, де текст іде в LLM; тут — просто заміна клавіатури).
 *
 * Джерело логіки: рушій голосу Інтегралика (`modules/intent/CommandPalette.vue`).
 * Коли голос Інтегралика підтвердять наживо — той компонент варто перевести на цей
 * композабл (прибрати дубль). Поки — canonical-двигун живе тут.
 *
 * Підтримка: Chrome (desktop/Android), Safari (iOS 14.5+/macOS), Edge. НЕ Firefox →
 * `supported=false`, консюмер просто не показує кнопку мікрофона (текст працює як завжди).
 */
const _SR =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

export function useVoiceDictation(opts: { lang?: string } = {}) {
  const supported = !!_SR
  const listening = ref(false)

  let recognition: any = null
  let model: Ref<string> | null = null
  let manualStop = false        // true = користувач сам натиснув «стоп» (не перезапускати)
  let committed = ''            // фіналізований текст сесії (переживає авто-рестарт)
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  function ensure() {
    if (recognition || !_SR) return recognition
    recognition = new _SR()
    recognition.lang = opts.lang || 'uk-UA'
    recognition.interimResults = true   // проміжний текст видно живцем
    recognition.continuous = true       // слухати ДАЛІ через паузи
    recognition.maxAlternatives = 1
    // Накопичуємо фіналізовані шматки; поле = committed + поточний interim.
    // resultIndex → беремо лише НОВІ результати, кожен final додається рівно раз.
    recognition.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) committed = (committed + ' ' + res[0].transcript).trim()
        else interim += res[0].transcript
      }
      if (model) model.value = (committed + ' ' + interim).trim()
    }
    // Web Speech зупиняється сам після тиші (навіть при continuous) — перезапускаємо,
    // поки користувач не натиснув «стоп». committed переживає рестарт → без втрат.
    recognition.onend = () => {
      if (manualStop) { listening.value = false; return }
      if (restartTimer) clearTimeout(restartTimer)
      restartTimer = setTimeout(() => {
        if (manualStop) { listening.value = false; return }
        try { recognition.start() } catch { listening.value = false }
      }, 250)   // невелика пауза уникає InvalidStateError (start одразу після end)
    }
    recognition.onerror = (ev: any) => {
      // no-speech/aborted — часті й нестрашні (onend перезапустить). Лише відмова
      // доступу до мікрофона / фатальні — реально зупиняють слухання.
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture') {
        manualStop = true
        listening.value = false
      }
    }
    return recognition
  }

  /** Почати диктовку в задане поле (голос дописує до наявного тексту). */
  function start(target: Ref<string>) {
    const r = ensure()
    if (!r) return
    model = target
    manualStop = false
    if (restartTimer) clearTimeout(restartTimer)   // скасувати відкладений рестарт попередньої сесії
    committed = (target.value || '').trim()        // база — те, що вже в полі
    try { r.start(); listening.value = true } catch { /* вже слухає */ }
  }

  /** Зупинити (користувач). */
  function stop() {
    manualStop = true
    if (restartTimer) clearTimeout(restartTimer)
    try { recognition && recognition.stop() } catch { /* noop */ }
    listening.value = false
  }

  function toggle(target: Ref<string>) {
    if (listening.value) stop()
    else start(target)
  }

  /**
   * Скинути базу накопичення. Викликати ПІСЛЯ того, як поле очищене ззовні (напр.
   * після відправки повідомлення) — інакше продовження диктовки дописало б надіслане.
   */
  function reset() { committed = '' }

  onBeforeUnmount(stop)

  return { supported, listening, toggle, start, stop, reset }
}
