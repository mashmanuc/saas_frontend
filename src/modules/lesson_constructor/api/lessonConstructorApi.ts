import apiClient from '@/utils/apiClient'

// ⚠️ ЗГЕНЕРОВАНО з backend/apps/lesson_constructor/domain/topic_taxonomy.py
//    Не редагувати руками: `python manage.py export_topics --write`.
//    SSOT: saas_docs/domains/LESSON_CONSTRUCTOR/TOPIC_TAXONOMY_DECISION.md
export const TOPICS = [
  { value: 'real-numbers',                                 label: 'Дійсні числа', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.natural',                         label: 'Натуральні числа', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.divisibility',                    label: 'Подільність', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions',                       label: 'Дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.ordinary',              label: 'Звичайні дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.fractions.decimal',               label: 'Десяткові дроби', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'real-numbers.rational',                        label: 'Раціональні числа', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems',                label: 'Відношення, відсотки, задачі', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.ratio',          label: 'Відношення', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.proportion',     label: 'Пропорції', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'ratios-percents-word-problems.percent',        label: 'Відсотки', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'powers',                                       label: 'Степінь та його властивості', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions',              label: 'Раціональні та ірраціональні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'rational-irrational-expressions.square-roots', label: 'Квадратні корені', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials',                                  label: 'Многочлени та розкладання на множники', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'polynomials.abbreviated-multiplication',       label: 'Формули скороченого множення', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-expressions',                  label: 'Показникові та логарифмічні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-trig-expressions',             label: 'Показникові, логарифмічні, тригонометричні вирази', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'measurement-units',                            label: 'Величини та одиниці вимірювання', section: 'Числа й вирази', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-rational-equations',          label: 'Лінійні, квадратні, раціональні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'word-problem-equations',                       label: 'Задачі на складання рівнянь', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'inequalities-systems',                         label: 'Нерівності та системи', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'irrational-trig-equations',                    label: 'Ірраціональні та тригонометричні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'exponential-log-equations',                    label: 'Показникові та логарифмічні рівняння', section: 'Рівняння й нерівності', block: 'Алгебра і початки аналізу' },
  { value: 'function-basics',                              label: 'Функції — основи', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'linear-quadratic-functions',                   label: 'Лінійні та квадратичні функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'exp-log-trig-functions',                       label: 'Показникові, логарифмічні, тригонометричні функції', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'sequences',                                    label: 'Послідовності', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'charts-dependencies',                          label: 'Діаграми та графіки залежностей', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'derivative',                                   label: 'Похідна', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'integral',                                     label: 'Інтеграл', section: 'Функції та початки аналізу', block: 'Алгебра і початки аналізу' },
  { value: 'combinatorics',                                label: 'Комбінаторика', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'probability-statistics',                       label: 'Теорія ймовірності та статистика', section: 'Комбінаторика, ймовірність, статистика', block: 'Алгебра і початки аналізу' },
  { value: 'basic-geometry-figures',                       label: 'Базові геометричні фігури', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'basic-geometry-figures.angles',                label: 'Кути', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles',                                    label: 'Трикутники', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.congruence',                         label: 'Ознаки рівності трикутників', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.similarity',                         label: 'Подібність трикутників', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'triangles.solving',                            label: "Розв'язування трикутників", section: 'Планіметрія', block: 'Геометрія' },
  { value: 'right-triangles',                              label: 'Прямокутні трикутники', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'rectangle-square',                             label: 'Прямокутник і квадрат', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'parallelogram-rhombus-trapezoid',              label: 'Паралелограм, ромб, трапеція', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'circle-polygon',                               label: 'Коло і многокутник', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'perimeter',                                    label: 'Периметр', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas',                                        label: 'Площі фігур', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.rectangle-square',                       label: 'Площа прямокутника і квадрата', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.triangle',                               label: 'Площа трикутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.parallelogram',                          label: 'Площа паралелограма, ромба, трапеції', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.polygon',                                label: 'Площа многокутника', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'areas.circle',                                 label: 'Площа круга і його частин', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-constructions',                      label: 'Геометричні побудови', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'geometric-transformations',                    label: 'Геометричні переміщення (рухи)', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'plane-vectors-coordinates',                    label: 'Вектори та координати на площині', section: 'Планіметрія', block: 'Геометрія' },
  { value: 'lines-planes-space',                           label: 'Прямі та площини у просторі', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'prism',                                        label: 'Призма', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'pyramid',                                      label: 'Піраміда', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'rotation-bodies',                              label: 'Тіла обертання', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement',                           label: "Площі поверхонь і об'єми тіл", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.surface',                   label: 'Площі поверхонь тіл', section: 'Стереометрія', block: 'Геометрія' },
  { value: 'solids-measurement.volume',                    label: "Об'єми тіл", section: 'Стереометрія', block: 'Геометрія' },
  { value: 'space-vectors-coordinates',                    label: 'Вектори та координати у просторі', section: 'Стереометрія', block: 'Геометрія' },
] as const

// Picker показує 2 стилі. Прибрано 2026-06-24:
//  - Rapid (4 задачі/стор.) — картки не влазили;
//  - visual (2 задачі/стор., крапки) — дублював academic за кількістю задач.
// Backend LessonTheme.VISUAL/RAPID лишаються (старі сесії/шаблони), у picker НЕ показуємо.
export const THEMES = [
  { value: 'nmt_exam', label: 'Класичний', desc: '1 задача на сторінку, чистий аркуш',   tasksPerPage: 1 },
  { value: 'academic', label: 'Наочний',   desc: '2 задачі на сторінку, фон у клітинку', tasksPerPage: 2 },
] as const

export const DIFF_PROFILES = [
  { value: 'easy',     label: 'Легкий' },
  { value: 'balanced', label: 'Збалансований' },
  { value: 'hard',     label: 'Важкий' },
  { value: 'exam',     label: 'Екзаменаційний' },
] as const

export const PACING_MODES = [
  { value: 'tutorial', label: 'Навчальний (теорія + розбір)' },
  { value: 'practice', label: 'Практика (тільки задачі)' },
  { value: 'exam',     label: 'Іспит (без підказок)' },
] as const

export interface GenerateLessonRequest {
  topics:               string[]
  /**
   * Тип уроку — заява вчителя. Від нього залежить каркас плану і скільки тем
   * можна взяти. Шлемо ЗАВЖДИ: сервер не має домислювати `intro` замість
   * вибору, якого не було (саме так виникала відмова «оберіть одну тему»
   * у вчителя, який тем ще не обирав).
   */
  lesson_type:          'intro' | 'practice' | 'control' | 'generalize' | 'repeat'
  task_count:           number
  theme:                string
  diff_profile?:        string
  pacing_mode?:         string
  include_theory_page?: boolean
  include_solution_page?: boolean
  board_bg?:            string    // hex color override for all pages (e.g. '#fef9f0')
  board_bg_palette?:    string[]  // різнокольоровий режим: палітра, що циклиться по practice-сторінках
  name?:                string
  random_seed?:         number | null
}

export interface GenerateLessonResponse {
  session_id:    string
  page_count:    number
  task_count:    number
  generation_ms: number
  theme_id:      string
}

export const lessonConstructorApi = {
  async generate(payload: GenerateLessonRequest): Promise<GenerateLessonResponse> {
    const res = await apiClient.post('/v1/lesson-constructor/generate/', payload)
    return res as unknown as GenerateLessonResponse
  },
}
