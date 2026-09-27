/**
 * useVoiceDictation — семантика ре-таргету поля.
 *
 * Навіщо саме ці тести. 2026-07-30 власник знайшов баг в Інтегралику: після
 * вибору дії зі списку мікрофон лишався активним, плейсхолдер обіцяв
 * «Слухаю… говоріть», але надиктоване НЕ з'являлося в полі. Причина — composable
 * тримає РЕФ поля, переданий у `start()`, а палітра має ДВА поля (`query` для
 * пошуку команд і `aiInput` для чату). Перемикання режиму міняло видиме поле,
 * але не реф → текст тихо йшов у сховане поле.
 *
 * Фікс у `CommandPalette.vue` (`retargetVoice()`) спирається на ОДНЕ нетривіальне
 * припущення: «`start(newRef)` під час активного слухання безпечно перецілює
 * запис у нове поле». Ці тести фіксують саме його — щоб фікс не розвалився при
 * майбутньому рефакторі composable.
 *
 * Заодно перший тест у покритті голосу (до цього — 0).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

/**
 * Двійник Web Speech API — рівно те, що читає composable.
 *
 * Б-108 (2026-09-27): як у справжньому Chrome, список `results` у межах сесії лише
 * РОСТЕ, а `resultIndex` — індекс нового елемента; `start()` відкриває нову сесію.
 * БУЛО: кожна подія — новий список з одного результату, тож двійник не міг показати,
 * що рушій робить на Android.
 */
class FakeRecognition {
  lang = ''
  interimResults = false
  continuous = false
  maxAlternatives = 0
  started = false
  results: any[] = []
  onresult: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: any) => void) | null = null

  start() {
    // Справжній рушій кидає InvalidStateError на повторний start() —
    // composable мусить це проглитнути, інакше ре-таргет ламався б.
    if (this.started) {
      const err: any = new Error('recognition already started')
      err.name = 'InvalidStateError'
      throw err
    }
    this.started = true
    this.results = []
  }

  stop() {
    this.started = false
    this.onend?.()
  }

  private push(res: any) {
    this.results.push(res)
    this.onresult?.({ resultIndex: this.results.length - 1, results: [...this.results] })
  }

  private dropInterim() {
    while (this.results.length && !this.results[this.results.length - 1].isFinal) this.results.pop()
  }

  /** Фінал настільного Chrome: з оцінкою; заміщає проміжний хвіст тієї ж фрази. */
  emitFinal(text: string, confidence = 0.9) {
    const res: any = [{ transcript: text, confidence }]
    res.isFinal = true
    this.dropInterim()
    this.push(res)
  }

  /** Проміжний результат настільного Chrome (isFinal = false) у хвості списку. */
  emitInterim(text: string) {
    const res: any = [{ transcript: text, confidence: 0 }]
    res.isFinal = false
    this.dropInterim()
    this.push(res)
  }

  /**
   * Chrome на Android у `continuous`: проміжна гіпотеза — ВСЯ фраза досі — приходить
   * ФІНАЛОМ з confidence 0 і дописується новим елементом
   * (`SpeechRecognitionImpl.java`: `if (mContinuous && provisional) provisional = false;`).
   */
  emitAndroidHypothesis(text: string) {
    const res: any = [{ transcript: text, confidence: 0 }]
    res.isFinal = true
    this.push(res)
  }

  /** Справжній фінал Android: з оцінкою; після нього Chromium завершує сесію. */
  emitAndroidFinal(text: string, confidence = 0.93) {
    const res: any = [{ transcript: text, confidence }]
    res.isFinal = true
    this.push(res)
    this.started = false
    this.onend?.()
  }
}

let instances: FakeRecognition[] = []

beforeEach(() => {
  instances = []
  vi.resetModules()
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).SpeechRecognition = class {
    constructor() {
      const r = new FakeRecognition()
      instances.push(r)
      return r as any
    }
  }
  delete (globalThis as any).webkitSpeechRecognition
})

/** Імпорт ПІСЛЯ підстановки: composable читає SpeechRecognition на import-time. */
async function load() {
  const mod = await import('../useVoiceDictation')
  return mod.useVoiceDictation
}

describe('useVoiceDictation — базова диктовка', () => {
  it('пише розпізнаний текст у переданий реф', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('привіт')

    expect(field.value).toBe('привіт')
    expect(v.listening.value).toBe(true)
  })

  it('дописує до наявного тексту, а не затирає його', async () => {
    const useVoiceDictation = await load()
    const field = ref('вже було')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('і додано')

    expect(field.value).toBe('вже було і додано')
  })

  it('lang береться з opts (геттер читається при першому старті)', async () => {
    const useVoiceDictation = await load()
    let locale = 'en'
    const v = useVoiceDictation({ get lang() { return locale === 'en' ? 'en-US' : 'uk-UA' } })

    v.start(ref(''))

    expect(instances[0].lang).toBe('en-US')
  })
})

describe('useVoiceDictation — РЕ-ТАРГЕТ (передумова фіксу CommandPalette)', () => {
  it('start(інший реф) під час слухання перецілює запис у новий реф', async () => {
    const useVoiceDictation = await load()
    const cmdField = ref('')      // «пошук команд» — видиме на старті
    const aiField = ref('')       // «чат» — стає видимим після вибору дії
    const v = useVoiceDictation()

    v.start(cmdField)
    instances[0].emitFinal('розкажи про похідну')
    expect(cmdField.value).toBe('розкажи про похідну')

    // Перемикання режиму: палітра ре-таргетить голос на нове видиме поле.
    // НЕ мусить кинути, хоч рушій уже слухає.
    expect(() => v.start(aiField)).not.toThrow()

    instances[0].emitFinal('а тепер приклад')

    expect(aiField.value).toBe('а тепер приклад')   // ← пише в НОВЕ поле
    expect(cmdField.value).toBe('розкажи про похідну')  // ← старе не змінилось
    expect(v.listening.value).toBe(true)            // ← слухання не обірвалось
  })

  it('після ре-таргету накопичення не тягне текст зі старого поля', async () => {
    const useVoiceDictation = await load()
    const cmdField = ref('')
    const aiField = ref('')
    const v = useVoiceDictation()

    v.start(cmdField)
    instances[0].emitFinal('перша фраза')
    v.start(aiField)                 // aiField порожній → база накопичення = ''
    instances[0].emitFinal('друга')

    // Якби база не пересівалася з нового поля, тут було б «перша фраза друга».
    expect(aiField.value).toBe('друга')
  })

  it('НЕ створює другий екземпляр рушія на ре-таргеті', async () => {
    const useVoiceDictation = await load()
    const v = useVoiceDictation()

    v.start(ref(''))
    v.start(ref(''))
    v.start(ref(''))

    // Інакше висіло б кілька паралельних розпізнавань на один мікрофон.
    expect(instances).toHaveLength(1)
  })
})

describe('useVoiceDictation — зупинка', () => {
  it('stop() гасить слухання і не рестартує через onend', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    v.stop()

    expect(v.listening.value).toBe(false)
    expect(instances[0].started).toBe(false)
  })

  it('reset() скидає базу накопичення (поле очищене ззовні)', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('надіслане')
    field.value = ''      // ззовні: повідомлення відправлено
    v.reset()
    instances[0].emitFinal('нове')

    expect(field.value).toBe('нове')   // без reset() було б «надіслане нове»
  })

  it('після stop() пізній результат рушія НЕ повертає текст у поле', async () => {
    // Власник 2026-09-25: надіслав фразу — вона лишилась у полі, мікрофон
    // червоний. Саме цей порядок: рушій дошле фінальний результат уже ПІСЛЯ
    // того, як застосунок очистив поле й зупинив диктовку.
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('Доброго вечора')
    expect(field.value).toBe('Доброго вечора')

    field.value = ''     // застосунок: повідомлення відправлено, поле очищене
    v.stop()             // і диктовку зупинено
    instances[0].emitFinal('')   // пізній фінал від рушія

    expect(field.value).toBe('')
    expect(v.listening.value).toBe(false)
  })

  it('після stop() нова диктовка не тягне попередню фразу', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('перша фраза')
    field.value = ''
    v.stop()

    v.start(field)
    instances[0].emitFinal('друга')

    expect(field.value).toBe('друга')
  })

  it('відмова доступу до мікрофона гасить слухання', async () => {
    const useVoiceDictation = await load()
    const v = useVoiceDictation()

    v.start(ref(''))
    instances[0].onerror?.({ error: 'not-allowed' })

    expect(v.listening.value).toBe(false)
  })
})

// ── Б-108 (власник 2026-09-27, Android-планшет) ─────────────────────────────
// Надіслане в Інтегралика: «Поясни Поясни мені Поясни мені Поясни мені що Поясни
// мені що я Поясни мені що я можу Поясни мені що я можу робити Поясни мені що я
// можу робити». Рівно такий рядок дає СТАРИЙ composable на послідовності подій,
// яку Chrome на Android шле в `continuous` (див. двійник вище).

/** Фраза власника так, як її віддає Chrome на Android: гіпотези + справжній фінал. */
const OWNER_HYPOTHESES = [
  'Поясни',
  'Поясни мені',
  'Поясни мені',
  'Поясни мені що',
  'Поясни мені що я',
  'Поясни мені що я можу',
  'Поясни мені що я можу робити',
]
const OWNER_PHRASE = 'Поясни мені що я можу робити'

describe('useVoiceDictation — Chrome на Android (Б-108)', () => {
  it('фраза власника не множиться: у полі одна фраза, а не всі гіпотези', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    for (const h of OWNER_HYPOTHESES) instances[0].emitAndroidHypothesis(h)
    instances[0].emitAndroidFinal(OWNER_PHRASE)

    expect(field.value).toBe(OWNER_PHRASE)
    v.stop()
  })

  it('розпізнавач, що дає гіпотезам оцінку, — теж без повторів (запобіжник)', async () => {
    // Якщо на якомусь пристрої проміжні гіпотези прийдуть з confidence > 0, правило
    // «confidence 0 = гіпотеза» не спрацює; рятує заміна шматка, який продовжують.
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    for (const h of OWNER_HYPOTHESES) instances[0].emitFinal(h, 0.8)

    expect(field.value).toBe(OWNER_PHRASE)
    v.stop()
  })

  it('поки людина говорить, поле показує останню гіпотезу без повторів', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    for (const h of OWNER_HYPOTHESES) {
      instances[0].emitAndroidHypothesis(h)
      expect(field.value).toBe(h)
    }
    v.stop()
  })

  it('рушій виправив слово в гіпотезі — у полі лише остання версія', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitAndroidHypothesis('Поясни мене')
    instances[0].emitAndroidHypothesis('Поясни мені що')
    instances[0].emitAndroidFinal('Поясни мені, що?')

    expect(field.value).toBe('Поясни мені, що?')
    v.stop()
  })

  it('друга фраза після авто-рестарту дописується, перша не множиться', async () => {
    vi.useFakeTimers()
    try {
      const useVoiceDictation = await load()
      const field = ref('')
      const v = useVoiceDictation()

      v.start(field)
      for (const h of OWNER_HYPOTHESES) instances[0].emitAndroidHypothesis(h)
      instances[0].emitAndroidFinal(OWNER_PHRASE)   // Chromium сам завершує сесію
      vi.advanceTimersByTime(300)                     // composable перезапускає рушій
      expect(instances[0].started).toBe(true)

      instances[0].emitAndroidHypothesis('і дай')
      instances[0].emitAndroidHypothesis('і дай приклад')
      expect(field.value).toBe(`${OWNER_PHRASE} і дай приклад`)
      instances[0].emitAndroidFinal('і дай приклад')

      expect(field.value).toBe(`${OWNER_PHRASE} і дай приклад`)
      v.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('сесія скінчилась без справжнього фіналу — остання гіпотеза не губиться', async () => {
    vi.useFakeTimers()
    try {
      const useVoiceDictation = await load()
      const field = ref('')
      const v = useVoiceDictation()

      v.start(field)
      instances[0].emitAndroidHypothesis('Поясни')
      instances[0].emitAndroidHypothesis('Поясни мені')
      instances[0].started = false
      instances[0].onend?.()                          // рушій обірвав сесію (тиша, мережа)
      vi.advanceTimersByTime(300)

      instances[0].emitAndroidHypothesis('що робити')
      expect(field.value).toBe('Поясни мені що робити')
      v.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('стоп посеред фрази: у полі остання гіпотеза, пізній фінал її не множить', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitAndroidHypothesis('Поясни')
    instances[0].emitAndroidHypothesis('Поясни мені')
    v.stop()
    instances[0].emitAndroidFinal('Поясни мені')      // рушій дошле фінал уже після стопу

    expect(field.value).toBe('Поясни мені')
    expect(v.listening.value).toBe(false)
  })

  it('ре-таргет посеред фрази: у нове поле — лише сказане після перемикання', async () => {
    const useVoiceDictation = await load()
    const cmdField = ref('')
    const aiField = ref('')
    const v = useVoiceDictation()

    v.start(cmdField)
    instances[0].emitAndroidHypothesis('розкажи про')
    v.start(aiField)
    // Android і далі повторює початок фрази в кожній гіпотезі.
    instances[0].emitAndroidHypothesis('розкажи про похідну')

    expect(aiField.value).toBe('похідну')
    expect(cmdField.value).toBe('розкажи про')
    v.stop()
  })
})

describe('useVoiceDictation — настільний Chrome (контроль до Б-108)', () => {
  it('окремі фінали й проміжний хвіст складаються як раніше', async () => {
    const useVoiceDictation = await load()
    const field = ref('')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('Поясни мені')
    instances[0].emitInterim('що я')
    expect(field.value).toBe('Поясни мені що я')
    instances[0].emitFinal('що я можу робити')

    expect(field.value).toBe('Поясни мені що я можу робити')
    v.stop()
  })

  it('кілька фраз в одній сесії не губляться і не повторюються', async () => {
    const useVoiceDictation = await load()
    const field = ref('вже було')
    const v = useVoiceDictation()

    v.start(field)
    instances[0].emitFinal('перша')
    instances[0].emitFinal('друга')
    instances[0].emitFinal('третя')

    expect(field.value).toBe('вже було перша друга третя')
    v.stop()
  })
})
