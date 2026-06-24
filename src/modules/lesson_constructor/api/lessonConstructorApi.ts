import apiClient from '@/utils/apiClient'

// 30 дозволених тем з NMT_PROBLEMS_JSON_CONTRACT
export const TOPICS = [
  { value: 'basic-geometry-figures',            label: 'Базові геометричні фігури' },
  { value: 'circle-polygon',                    label: 'Коло і многокутник' },
  { value: 'combinatorics',                     label: 'Комбінаторика' },
  { value: 'derivative',                        label: 'Похідна' },
  { value: 'exp-log-trig-functions',            label: 'Показникові, логарифмічні, тригонометричні функції' },
  { value: 'exponential-log-equations',         label: 'Показникові та логарифмічні рівняння' },
  { value: 'exponential-log-expressions',       label: 'Показникові та логарифмічні вирази' },
  { value: 'exponential-log-trig-expressions',  label: 'Показникові, логарифмічні, тригонометричні вирази' },
  { value: 'function-basics',                   label: 'Функції — основи' },
  { value: 'inequalities-systems',              label: 'Нерівності та системи' },
  { value: 'integral',                          label: 'Інтеграл' },
  { value: 'irrational-trig-equations',         label: 'Ірраціональні та тригонометричні рівняння' },
  { value: 'linear-quadratic-functions',        label: 'Лінійні та квадратичні функції' },
  { value: 'linear-quadratic-rational-equations', label: 'Лінійні, квадратні, раціональні рівняння' },
  { value: 'lines-planes-space',                label: 'Прямі та площини у просторі' },
  { value: 'parallelogram-rhombus-trapezoid',   label: 'Паралелограм, ромб, трапеція' },
  { value: 'plane-vectors-coordinates',         label: 'Вектори та координати на площині' },
  { value: 'prism',                             label: 'Призма' },
  { value: 'probability-statistics',            label: 'Теорія ймовірності та статистика' },
  { value: 'pyramid',                           label: 'Піраміда' },
  { value: 'rational-irrational-expressions',  label: 'Раціональні та ірраціональні вирази' },
  { value: 'ratios-percents-word-problems',     label: 'Відношення, відсотки, задачі' },
  { value: 'real-numbers',                      label: 'Дійсні числа' },
  { value: 'rectangle-square',                  label: 'Прямокутник і квадрат' },
  { value: 'right-triangles',                   label: 'Прямокутні трикутники' },
  { value: 'rotation-bodies',                   label: 'Тіла обертання' },
  { value: 'sequences',                         label: 'Послідовності' },
  { value: 'space-vectors-coordinates',         label: 'Вектори та координати у просторі' },
  { value: 'triangles',                         label: 'Трикутники' },
  { value: 'word-problem-equations',            label: 'Задачі на складання рівнянь' },
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
