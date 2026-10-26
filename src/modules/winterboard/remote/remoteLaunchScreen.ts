/**
 * Запуск уроку з пульта — бік комп'ютера (LAW §9 v1.63, маніфест пульта П8, 2026-10-26).
 *
 * Кожна вкладка сайту каже серверу загальним каналом «мене щойно торкались»
 * (`remote.here`: ключ пункту меню поточної сторінки і скільки мс тому дотик) —
 * при (пере)підключенні, після дотику (не частіше ніж раз на 3 с, останній дотик
 * не губиться) і після переходу сторінкою. Пульт відкриває урок на вкладці, якої
 * торкались ОСТАННЬОЮ (власник: «до останнього хіба що?»); сервер шле їй
 * `remote.launch` з уроком із «Моїх уроків», і вкладка робить те саме, що кнопка
 * «Провести»: свіжа копія уроку, шаблон не змінюється (v1.65) — пише лише ноутбук.
 *
 * Сторінка пульта й телефон не шлють: телефон — пульт, а не екран класу.
 */
import type { Router } from 'vue-router'
import { realtimeService } from '@/services/realtime'
import { SECTIONED_MENU_BY_ROLE } from '@/config/menu'
import { i18n } from '@/i18n'
import { notifyError } from '@/utils/notify'

export const HERE_THROTTLE_MS = 3_000

const PULT_ROUTES = new Set(['winterboard-remote', 'winterboard-remote-board'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type MenuItem = { label?: unknown; to?: unknown }
type MenuSection = { items?: MenuItem[] }

/** Ключ пункту бокового меню для шляху (найдовший збіг) — так пульт назве сторінку. */
export function pageKeyFor(path: string): string | null {
  let best: { to: string; label: string } | null = null
  for (const section of (SECTIONED_MENU_BY_ROLE.tutor ?? []) as MenuSection[]) {
    for (const item of section.items ?? []) {
      const { to, label } = item
      if (typeof to !== 'string' || typeof label !== 'string') continue
      if (path !== to && !path.startsWith(`${to}/`)) continue
      if (!best || to.length > best.to.length) best = { to, label }
    }
  }
  return best?.label ?? null
}

/** Телефон: лише дотик і мала сторона екрана. Велика сенсорна панель класу — екран, не пульт. */
export function isPhoneScreen(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  const side = Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0)
  return coarse && side > 0 && side < 600
}

export function installRemoteLaunchScreen(router: Router): () => void {
  if (typeof window === 'undefined') return () => {}

  let lastTouch = Date.now()          // відкриття сторінки — теж дія вчителя
  let lastSent = 0
  let trailing: ReturnType<typeof setTimeout> | null = null
  let launching = false               // одне «Провести» за раз, як кнопка в «Моїх уроках»

  const onPult = () => PULT_ROUTES.has(String(router.currentRoute.value.name ?? ''))

  function send(): void {
    if (trailing) { clearTimeout(trailing); trailing = null }
    if (onPult() || isPhoneScreen()) return
    // Не на зв'язку — `connection.established` після підключення надішле сам.
    if (realtimeService.getState() !== 'open') return
    lastSent = Date.now()
    realtimeService.send({
      type: 'remote.here',
      page: pageKeyFor(router.currentRoute.value.path),
      ago: Math.max(0, lastSent - lastTouch),
    })
  }

  function onTouch(): void {
    lastTouch = Date.now()
    const wait = lastSent + HERE_THROTTLE_MS - lastTouch
    if (wait <= 0) send()
    else if (!trailing) trailing = setTimeout(send, wait)
  }

  const offTouch = (() => {
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', onTouch, opts)
    window.addEventListener('keydown', onTouch, opts)
    return () => {
      window.removeEventListener('pointerdown', onTouch, opts)
      window.removeEventListener('keydown', onTouch, opts)
    }
  })()

  const offRoute = router.afterEach(() => {
    if (document.visibilityState === 'visible' && document.hasFocus()) lastTouch = Date.now()
    send()
  })

  const offProtocol = realtimeService.on('protocol', (data: { type?: string }) => {
    if (data?.type === 'connection.established') send()
  })

  // v1.65: «Провести» — та сама дія, що кнопка в «Моїх уроках»: свіжа копія уроку з шаблону.
  // Дошку за id (v1.63) більше не відкриваємо: так пульт відкривав шаблон Студії як урок.
  async function conduct(lessonId: string): Promise<void> {
    launching = true
    try {
      const { lessonViewApi } = await import('@/modules/knowledge/api/lessonViewApi')
      const { session_id } = await lessonViewApi.loadToSession(lessonId)
      await router.push({ name: 'winterboard-solo', params: { id: session_id } })
    } catch (err) {
      console.error('[remoteLaunch] conduct failed:', err)
      notifyError(i18n.global.t('knowledge.lesson.prepare.error'))
    } finally {
      launching = false
    }
  }

  const offMessage = realtimeService.on('message', (data: { type?: string; lesson_id?: unknown }) => {
    if (data?.type !== 'remote.launch') return
    const id = typeof data.lesson_id === 'string' ? data.lesson_id : ''
    if (!UUID_RE.test(id) || onPult() || launching) return
    void conduct(id)
  })

  return () => {
    if (trailing) clearTimeout(trailing)
    offTouch()
    offRoute()
    offProtocol()
    offMessage()
  }
}
