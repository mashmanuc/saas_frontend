/**
 * «Збірник» — третя вкладка бічної панелі (власник 2026-10-28). НАШ збірник із задач банку з нашого сервера
 * (`apps/learning_content/zbirnyk`): розділи → рівні → задачі з умовою для перегляду; на дошку — картка задачі,
 * яку будує сервер. `id` тем і `ref.id` задач — непрозорі: зберігаємо й передаємо, не розбираємо.
 *
 * Кеш на рівні модуля: огляд і відкриті теми живуть до перезавантаження сторінки — вкладку перемикають
 * часто, а збірник за урок не змінюється. Невдачу не кешуємо: «Спробувати ще» питає сервер знову.
 */
import { reactive } from 'vue'
import apiClient from '@/utils/apiClient'

const BASE = '/v1/learning-content/zbirnyk'

/** MIME перетягування задачі зі «Збірника» на дошку; payload — `{"id": ref.id}`. */
export const ZBIRNYK_TASK_MIME = 'application/vnd.m4sh.zbirnyk-task'

export interface ZbirnykTaskRef { provider: string; id: string }
export interface ZbirnykTask {
  ref: ZbirnykTaskRef
  /** Місце в рівні за файлом збірника; відсіяна сервером задача лишає дірку. */
  number: number
  type: 'single_choice' | 'open_answer' | 'matching'
  /** Умова з LaTeX. */
  text: string
  choices?: { label: string; text: string }[]
  left?: { id: string; text: string }[]
  right?: { id: string; text: string }[]
  /** Для показу вчителю у вкладці; на дошку не йде. */
  answer: string | null
}
/** `title` — назва категорії від сервера («Тести», «Відповідність», «Коротка відповідь»); немає — «Рівень N». */
export interface ZbirnykLevel { level: number; title?: string; tasks: ZbirnykTask[] }
export interface ZbirnykTheme { id: string; number: string; title: string; levels: ZbirnykLevel[] }
export interface ZbirnykThemeSummary {
  id: string
  number: string
  title: string
  levels: { level: number; count: number; title?: string }[]
}

type Unavailable = { status: 'unavailable' }
export type ZbirnykOverviewResponse = { status: 'ready'; themes: ZbirnykThemeSummary[] } | Unavailable
export type ZbirnykThemeResponse = ({ status: 'ready' } & ZbirnykTheme) | Unavailable
/** Картка задачі для дошки — та сама, що з генератора уроку (`nmt_task`, 200 %). */
export type ZbirnykCardResponse =
  { status: 'ready'; type: 'nmt_task'; w: number; h: number; data: Record<string, unknown> } | Unavailable

let overviewPromise: Promise<ZbirnykOverviewResponse> | null = null
const themes = new Map<string, ZbirnykTheme>()

export function getZbirnykOverview(): Promise<ZbirnykOverviewResponse> {
  overviewPromise ??= apiClient.get<ZbirnykOverviewResponse>(`${BASE}/`)
    .then((r) => {
      if (r?.status !== 'ready') overviewPromise = null
      return r
    }, (err) => {
      overviewPromise = null
      throw err
    })
  return overviewPromise
}

export async function getZbirnykTheme(id: string): Promise<ZbirnykThemeResponse> {
  const cached = themes.get(id)
  if (cached) return { status: 'ready', ...cached }
  const r = await apiClient.get<ZbirnykThemeResponse>(`${BASE}/themes/${encodeURIComponent(id)}/`)
  if (r?.status === 'ready') {
    const { status: _s, ...theme } = r
    themes.set(id, theme)
  }
  return r
}

export function getZbirnykCard(taskId: string): Promise<ZbirnykCardResponse> {
  return apiClient.get<ZbirnykCardResponse>(`${BASE}/tasks/${encodeURIComponent(taskId)}/card/`)
}

/** Задачі, що зараз ідуть на дошку: плитка показує «Додаю…» і не приймає повторний натиск. */
export const zbirnykAdding = reactive(new Set<string>())

/** Де вчитель зупинився — переживає перемикання вкладок. */
export const zbirnykView = reactive<{ themeId: string | null; level: number }>({ themeId: null, level: 1 })

/** Лише для тестів. */
export function _resetZbirnykCache(): void {
  overviewPromise = null
  themes.clear()
  zbirnykAdding.clear()
  zbirnykView.themeId = null
  zbirnykView.level = 1
}
