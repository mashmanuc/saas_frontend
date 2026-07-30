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

/** Мінімальний двійник Web Speech API — рівно те, що читає composable. */
class FakeRecognition {
  lang = ''
  interimResults = false
  continuous = false
  maxAlternatives = 0
  started = false
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
  }

  stop() {
    this.started = false
    this.onend?.()
  }

  /** Подати фінальний результат так, як його бачить composable. */
  emitFinal(text: string) {
    const res: any = [{ transcript: text }]
    res.isFinal = true
    this.onresult?.({ resultIndex: 0, results: [res] })
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

  it('відмова доступу до мікрофона гасить слухання', async () => {
    const useVoiceDictation = await load()
    const v = useVoiceDictation()

    v.start(ref(''))
    instances[0].onerror?.({ error: 'not-allowed' })

    expect(v.listening.value).toBe(false)
  })
})
