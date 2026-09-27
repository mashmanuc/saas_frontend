import { ref, onBeforeUnmount, type Ref } from 'vue'

/**
 * Голосова диктовка (Web Speech API) як спільний клієнт вводу.
 *
 * Пише розпізнаний текст у переданий model-ref:
 *  - `continuous` + авто-рестарт після тиші → мікрофон не глухне після 1 фрази;
 *  - накопичення (`base`) переживає авто-рестарт → раніше сказане НЕ втрачається;
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
 *
 * ⚠️ Chrome на Android (Б-108, власник 2026-09-27, планшет): надіслане «Поясни Поясни мені
 * Поясни мені Поясни мені що … Поясни мені що я можу робити». Причина — у самому Chromium:
 * у режимі `continuous` він віддає КОЖНУ проміжну гіпотезу Android як ФІНАЛЬНИЙ результат
 * (`SpeechRecognitionImpl.java`: `if (mContinuous && provisional) provisional = false;`),
 * з `confidence = 0` (у проміжного пакета Android немає оцінок —
 * `speech_recognizer_impl_android.cc` ставить 0.0), і кожна гіпотеза — ВСЯ фраза, почута
 * на цей момент, дописана НОВИМ елементом у `results`. Справжній фінал (з оцінкою)
 * приходить окремо й завершує сесію. БУЛО: «дописати кожен isFinal» → кожна гіпотеза
 * ставала шматком тексту. ТЕПЕР текст сесії складається з УСЬОГО списку `results`
 * (`assembleSpeech`), а фінал із confidence 0 — лише гіпотеза поточної фрази, яку
 * замінює наступний результат тієї ж фрази.
 */
const _SR =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

/** Один результат рушія — рівно те, що потрібно для складання тексту. */
export interface SpeechPiece {
  text: string
  isFinal: boolean
  confidence: number
}

export interface AssembledSpeech {
  /** Фіналізовані шматки сесії. */
  final: string
  /** Гіпотеза поточної фрази, яку Chrome на Android віддав «фіналом» з confidence 0. */
  pending: string
  /** Проміжний хвіст (isFinal = false) — видно живцем, у накопичення не йде. */
  interim: string
  /** Що показувати в полі: final + pending + interim. */
  live: string
}

const EMPTY: AssembledSpeech = { final: '', pending: '', interim: '', live: '' }

function join(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(' ')
}

/** Слово для порівняння: без регістру й розділових знаків (апострофи всіх видів — теж). */
function normWord(w: string): string {
  return w.toLowerCase().replace(/[.,!?;:…"«»„“”()'’ʼ‘—–]/g, '')
}

function normWords(s: string): string[] {
  return s.split(/\s+/).map(normWord).filter(Boolean)
}

/** Скільки слів `prefix` стоїть на початку `text` (усі — або 0). */
function prefixWords(text: string, prefix: string): number {
  const t = normWords(text)
  const p = normWords(prefix)
  if (!p.length || p.length > t.length) return 0
  for (let i = 0; i < p.length; i++) if (t[i] !== p[i]) return 0
  return p.length
}

/** `text` без слів `prefix` на початку (решта — з тим самим регістром і знаками). */
function stripPrefix(text: string, prefix: string): string {
  const n = prefixWords(text, prefix)
  if (!n) return text
  const tokens = text.trim().split(/\s+/)
  let seen = 0
  let i = 0
  while (i < tokens.length && seen < n) {
    if (normWord(tokens[i])) seen++
    i++
  }
  return tokens.slice(i).join(' ')
}

/** Та сама фраза: перше слово збігається (гіпотези однієї фрази починаються однаково). */
function sameStart(a: string, b: string): boolean {
  const x = normWords(a)[0]
  return !!x && x === normWords(b)[0]
}

/**
 * Текст однієї сесії розпізнавання з УСІХ її результатів (Б-108).
 *  - фінал з confidence > 0 — окремий шматок; якщо він повторює або продовжує
 *    попередній шматок — замінює його (запобіжник на рушій, що повторює фінали);
 *  - фінал з confidence 0 (Chrome на Android у `continuous`) — гіпотеза поточної
 *    фрази: наступний результат ТІЄЇ Ж фрази її замінює, інакше вона лишається шматком;
 *  - проміжні (isFinal = false) — живий хвіст.
 */
export function assembleSpeech(pieces: SpeechPiece[]): AssembledSpeech {
  const segs: string[] = []
  let pending = ''
  let interim = ''
  const pushSeg = (t: string) => {
    const last = segs[segs.length - 1]
    if (last !== undefined && prefixWords(t, last)) segs[segs.length - 1] = t
    else if (last !== undefined && prefixWords(last, t)) return
    else segs.push(t)
  }
  for (const p of pieces) {
    const t = p.text.trim()
    if (!t) continue
    if (!p.isFinal) { interim = join(interim, t); continue }
    if (pending) {
      if (!sameStart(t, pending)) pushSeg(pending)
      pending = ''
    }
    if (p.confidence > 0) pushSeg(t)
    else pending = t
  }
  const final = segs.join(' ')
  return { final, pending, interim, live: join(final, pending, interim) }
}

export function useVoiceDictation(opts: { lang?: string } = {}) {
  const supported = !!_SR
  const listening = ref(false)

  let recognition: any = null
  let model: Ref<string> | null = null
  let manualStop = false        // true = користувач сам натиснув «стоп» (не перезапускати)
  let base = ''                 // текст до поточної сесії: поле на старті + попередні сесії
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  // Поточна сесія рушія (між start і onend): `results` у ній лише РОСТЕ.
  let seen = 0                  // скільки результатів сесії вже бачили
  let cutIndex = 0              // results[0..cutIndex) належать попередньому полю / вже надіслані
  let cutText = ''              // їхній текст — Android повторює його на початку кожної гіпотези
  let session: AssembledSpeech = EMPTY

  function newSession() {
    seen = 0
    cutIndex = 0
    cutText = ''
    session = EMPTY
  }

  /** Сказане досі в цій сесії більше не належить полю (ре-таргет, reset). */
  function cutHere() {
    cutText = join(cutText, session.live)
    cutIndex = seen
    session = EMPTY
  }

  function ensure() {
    if (recognition || !_SR) return recognition
    recognition = new _SR()
    recognition.lang = opts.lang || 'uk-UA'
    recognition.interimResults = true   // проміжний текст видно живцем
    recognition.continuous = true       // слухати ДАЛІ через паузи
    recognition.maxAlternatives = 1
    // Поле = база + текст сесії, складений з УСІХ результатів сесії після зрізу.
    recognition.onresult = (e: any) => {
      // Пізній результат після зупинки ігноруємо повністю (див. `stop()`).
      if (manualStop || !model) return
      const pieces: SpeechPiece[] = []
      for (let i = cutIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const alt = res[0] || {}
        const raw = String(alt.transcript || '')
        pieces.push({
          text: cutText ? stripPrefix(raw, cutText) : raw,
          isFinal: !!res.isFinal,
          confidence: Number(alt.confidence) || 0,
        })
      }
      seen = e.results.length
      session = assembleSpeech(pieces)
      model.value = join(base, session.live)
    }
    // Web Speech зупиняється сам після тиші (навіть при continuous) — перезапускаємо,
    // поки користувач не натиснув «стоп». Текст сесії стає базою → без втрат.
    recognition.onend = () => {
      // Фінал сесії + гіпотеза Android, якщо справжній фінал так і не прийшов.
      // Проміжний хвіст — ні (як і раніше).
      if (model) base = join(base, session.final, session.pending)
      newSession()
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
    base = (target.value || '').trim()             // база — те, що вже в полі
    cutHere()                                      // сказане раніше в цій сесії — не для цього поля
    try { r.start(); listening.value = true } catch { /* вже слухає */ }
  }

  /** Зупинити (користувач або застосунок після відправки). */
  function stop() {
    manualStop = true
    if (restartTimer) clearTimeout(restartTimer)
    try { recognition && recognition.stop() } catch { /* noop */ }
    listening.value = false
    // 🔴 Власник 2026-09-25: надіслав фразу — вона ЛИШИЛАСЬ у полі, мікрофон
    // червоний. Рушій Web Speech дошилає фінальний результат уже ПІСЛЯ
    // `stop()`, а `onresult` писав його в поле з накопиченої бази — тобто
    // повертав щойно надіслане речення назад. Відв'язуємо поле й гасимо базу:
    // після зупинки писати більше нікуди й нічого.
    base = ''
    model = null
  }

  function toggle(target: Ref<string>) {
    if (listening.value) stop()
    else start(target)
  }

  /**
   * Скинути базу накопичення. Викликати ПІСЛЯ того, як поле очищене ззовні (напр.
   * після відправки повідомлення) — інакше продовження диктовки дописало б надіслане.
   */
  function reset() {
    base = ''
    cutHere()
  }

  onBeforeUnmount(stop)

  return { supported, listening, toggle, start, stop, reset }
}
