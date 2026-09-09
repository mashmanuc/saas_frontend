/**
 * Правила вибору тем за типом уроку — клієнтська половина.
 *
 * НАВІЩО ВОНА ВЗАГАЛІ ІСНУЄ. Ці ж правила є на бекенді
 * (`lesson_constructor/domain/course_constraints.validate_focus`) і саме там
 * вони обов'язкові. Але якщо перевіряти тільки там, учитель дізнається про
 * помилку аж після натискання «Згенерувати» — і побачить 400 замість поради.
 * 2026-09-08 це вже сталося наживо: конструктор дозволив дві теми, а сервер
 * відмовив. Тому клієнт має сказати те саме ДО запиту.
 *
 * ⚠️ СПОРІДНЕНІСТЬ ЧИТАЄТЬСЯ ЗІ SLUG-А. `areas.circle` і `areas.parallelogram`
 * споріднені, бо мають спільний префікс `areas` — рівно те, що на бекенді
 * робить `topic_taxonomy.resolve_ancestors`. Ця відповідність не випадкова, і
 * її стереже BE-тест `TestClientCanComputeKinshipFromTheSlug`: якщо колись
 * з'явиться тема, у якої `parent` не дорівнює префіксу, тест упаде тут, а не
 * в учителя на екрані.
 */

export type LessonType = 'intro' | 'practice' | 'control' | 'generalize' | 'repeat'

export interface LessonTypeOption {
  value: LessonType
  label: string
  /** Один рядок про те, коли цей тип доречний. */
  hint: string
}

/** Порядок тут — порядок на екрані: від «нової теми» до «повторення». */
export const LESSON_TYPE_OPTIONS: readonly LessonTypeOption[] = [
  { value: 'intro',      label: 'Вивчення нової теми', hint: 'одна тема, яку пояснюємо вперше' },
  { value: 'practice',   label: 'Закріплення',         hint: 'одна тема, яку тренуємо' },
  { value: 'control',    label: 'Контроль',            hint: 'одна тема, яку перевіряємо' },
  { value: 'generalize', label: 'Узагальнення',        hint: 'дві споріднені теми одного розділу' },
  { value: 'repeat',     label: 'Повторення',          hint: 'дві споріднені теми одного розділу' },
] as const

const SINGLE_TOPIC_TYPES: readonly LessonType[] = ['intro', 'practice', 'control']
const BLOCK_TYPES: readonly LessonType[] = ['generalize', 'repeat']

/** Скільки тем має бути РІВНО для цього типу. */
export function topicsRequiredFor(type: LessonType | ''): number {
  if (!type) return 0
  return BLOCK_TYPES.includes(type as LessonType) ? 2 : 1
}

export function isBlockType(type: LessonType | ''): boolean {
  return BLOCK_TYPES.includes(type as LessonType)
}

export function labelOf(type: LessonType | ''): string {
  return LESSON_TYPE_OPTIONS.find(o => o.value === type)?.label ?? ''
}

/** Ланцюжок предків слага: 'areas.circle' → ['areas', 'areas.circle']. */
export function ancestorsOf(topic: string): string[] {
  const parts = topic.split('.')
  return parts.map((_, i) => parts.slice(0, i + 1).join('.'))
}

/** Чи мають теми спільний розділ. Одна тема — тривіально так. */
export function shareAnAncestor(topics: string[]): boolean {
  if (topics.length < 2) return true
  const sets = topics.map(t => new Set(ancestorsOf(t)))
  return [...sets[0]].some(a => sets.every(s => s.has(a)))
}


/**
 * Коди відмов фокуса — ДЗЕРКАЛО бекенду (`course_constraints.FOCUS_*`).
 *
 * КОД — КОНТРАКТ, ТЕКСТ — НІ. Бекенд віддає код; людське пояснення живе тут
 * і може переписуватись вільно. Саме тому тест перевіряє відповідність КОДІВ,
 * а не збіг рядків: інакше кожна правка формулювання ламала б тест, і його
 * швидко почали б правити «щоб зелений», а не щоб правдивий.
 */
export type FocusCode =
  | 'focus_empty'
  | 'focus_single_topic'
  | 'focus_pair_required'
  | 'focus_no_common_section'
  | 'focus_ancestor_pair'
  | 'focus_unknown_type'

export interface FocusIssue {
  code: FocusCode
  message: string
}

/**
 * Чи є одна тема предком іншої: 'areas' і 'areas.circle'.
 *
 * Узагальнювати розділ із його ж частиною нема чого. На бекенді те саме
 * рахує таксономія; тут — префікс слага, і відповідність цих двох способів
 * стереже BE-тест `TestClientCanComputeKinshipFromTheSlug`.
 */
export function isAncestorPair(topics: string[]): boolean {
  if (topics.length !== 2) return false
  const [a, b] = topics
  return a !== b && (ancestorsOf(b).includes(a) || ancestorsOf(a).includes(b))
}

/**
 * Чому ще не можна генерувати — людською мовою, або `null`, якщо все гаразд.
 *
 * Повертає саме ПОЯСНЕННЯ, а не булеве: заблокована кнопка без причини — це
 * та сама глуха стіна, лише мовчазна.
 */
export function focusIssueOf(
  type: LessonType | '',
  topics: string[],
): FocusIssue | null {
  if (!type) {
    return { code: 'focus_unknown_type',
      message: 'Спершу оберіть тип уроку — від нього залежить, скільки тем брати.' }
  }
  if (topics.length === 0) {
    return { code: 'focus_empty', message: isBlockType(type)
      ? 'Оберіть дві споріднені теми одного розділу.'
      : 'Оберіть одну тему уроку.' }
  }

  if (SINGLE_TOPIC_TYPES.includes(type as LessonType)) {
    if (topics.length > 1) {
      return { code: 'focus_single_topic',
        message: `«${labelOf(type)}» — це урок про одну тему, а обрано ${topics.length}. `
          + 'Залиште головну або оберіть «Узагальнення» чи «Повторення».' }
    }
    return null
  }

  if (topics.length !== 2) {
    return { code: 'focus_pair_required',
      message: `«${labelOf(type)}» будується на двох споріднених темах, а обрано `
        + `${topics.length}. Узагальнювати можна те, між чим є зв'язок.` }
  }
  if (!shareAnAncestor(topics)) {
    return { code: 'focus_no_common_section',
      message: 'Ці теми з різних розділів — між ними немає чого узагальнювати. '
        + 'Візьміть дві теми одного розділу або зробіть два окремі уроки.' }
  }
  if (isAncestorPair(topics)) {
    return { code: 'focus_ancestor_pair',
      message: 'Одна з тем є частиною іншої, тож узагальнювати нема чого. '
        + 'Візьміть дві різні підтеми одного розділу.' }
  }
  return null
}

/** Те саме одним рядком — для наявних місць, що чекають текст. */
export function focusIssue(type: LessonType | '', topics: string[]): string | null {
  return focusIssueOf(type, topics)?.message ?? null
}

/**
 * Що лишити з уже обраних тем при зміні типу — і що сказати вчителю.
 *
 * Мовчки чистити не можна: вибір зникає з екрана, і людина не розуміє, чому.
 * Тому разом зі списком повертаємо готове пояснення.
 */
export function reconcileTopics(
  type: LessonType | '',
  topics: string[],
): { topics: string[]; notice: string | null } {
  if (!type || topics.length === 0) return { topics, notice: null }

  const need = topicsRequiredFor(type)

  if (!isBlockType(type)) {
    if (topics.length <= need) return { topics, notice: null }
    const kept = topics.slice(0, need)
    return {
      topics: kept,
      notice: `«${labelOf(type)}» — урок про одну тему, тому лишила першу обрану. `
        + 'Оберіть іншу, якщо потрібна не ця.',
    }
  }

  // Блоковий тип: лишаємо максимум дві, і лише якщо вони споріднені.
  const kept = topics.slice(0, need)
  if (kept.length === 2 && !shareAnAncestor(kept)) {
    return {
      topics: [kept[0]],
      notice: 'Обрані теми з різних розділів, тому лишила першу. '
        + 'Додайте до неї сусідню тему того самого розділу.',
    }
  }
  if (kept.length === 2 && isAncestorPair(kept)) {
    return {
      topics: [kept[0]],
      notice: 'Одна тема була частиною іншої, тому лишила першу. '
        + 'Додайте другу підтему того самого розділу.',
    }
  }
  if (topics.length > need) {
    return {
      topics: kept,
      notice: `«${labelOf(type)}» будується на двох темах, тому лишила перші дві.`,
    }
  }
  return { topics: kept, notice: null }
}

/**
 * Чи можна взагалі клікнути цю тему зараз (для вигляду «неактивна»).
 * Уже обрану завжди можна зняти.
 */
export function canPickTopic(
  type: LessonType | '',
  selected: string[],
  topic: string,
): boolean {
  if (selected.includes(topic)) return true
  if (!type) return false
  if (selected.length >= topicsRequiredFor(type)) return false
  // Для блокових типів другою можна взяти лише споріднену — інакше вчитель
  // обере пару, яку сервер усе одно відхилить.
  if (isBlockType(type) && selected.length === 1) {
    // Споріднена — і при цьому НЕ предок і не нащадок уже обраної: інакше
    // вчитель складе пару «розділ + його частина», яку сервер відхилить.
    const pair = [...selected, topic]
    return shareAnAncestor(pair) && !isAncestorPair(pair)
  }
  return true
}
