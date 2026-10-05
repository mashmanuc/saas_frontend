/**
 * Позначка «гість без акаунта зайшов на сайт» — для staff «Сьогодні на сайті» (власник 2026-10-01:
 * «відображати в staff скільки гостей зайшло на сайт»; реклама веде на /start, а лендінг нічого
 * не писав, тож тих, хто подивився й пішов, не було видно взагалі).
 *
 * Одна подія `site.visit` на браузер на київську добу — та сама межа, що й у підсумку на бекенді
 * (`apps/analytics/services/presence.visits_today`). Без PII і кукі: випадковий id із localStorage —
 * той самий `m4sh:anon-id`, що в дошки без акаунта (візит і воронку дошки можна зшити); шаблон
 * маршруту замість адреси (з `/invite/:token` токен не їде); лише домен, з якого прийшли, і utm-мітки.
 *
 * ⚠️ Ім'я події — контракт із бекендом (`presence.VISIT_EVENT`): репозиторії різні, CI розсинхрону
 * не зловить — лічильник просто показуватиме нулі.
 */
import { flush, trackEvent } from '@/utils/telemetryAgent'
import { getAnonId } from '@/modules/winterboard/local/localWorkspaceTelemetry'

export const SITE_VISIT_EVENT = 'site.visit'
// ⚠️ Контракт із бекендом (`presence.REGISTER_OPEN_EVENT`) — див. `trackRegisterOpen` нижче.
export const REGISTER_OPEN_EVENT = 'site.register_open'
const DAY_KEY = 'm4sh:visit-day'
const REGISTER_DAY_KEY = 'm4sh:register-open-day'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const

export interface VisitRoute {
  matched?: ReadonlyArray<{ path?: string }>
  query?: Record<string, unknown>
}

function kyivDay(now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

function referrerHost(): string {
  try {
    if (!document.referrer) return ''
    const host = new URL(document.referrer).hostname
    return host === window.location.hostname ? '' : host
  } catch {
    return ''
  }
}

/**
 * Раз на добу на браузер; ніколи не кидає. Кликати лише для гостя без акаунта — після першої
 * навігації роутера (`src/main.js`), коли відомо, куди саме він зайшов.
 */
export function trackSiteVisit(route: VisitRoute, now: Date = new Date()): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return // автоматизація, не людина
    const day = kyivDay(now)
    try {
      if (localStorage.getItem(DAY_KEY) === day) return
      localStorage.setItem(DAY_KEY, day)
    } catch {
      // localStorage недоступний (приватне вікно) — шлемо без дедупу
    }
    const matched = route.matched ?? []
    const context: Record<string, string> = {
      anon_id: getAnonId(),
      route: matched.length ? matched[matched.length - 1].path || '' : '',
      ref: referrerHost(),
    }
    for (const key of UTM_KEYS) {
      const value = route.query?.[key]
      if (typeof value === 'string' && value) context[key] = value.slice(0, 64)
    }
    trackEvent(SITE_VISIT_EVENT, context)
    // Одразу, не за 10 с: гість, що подивився лендінг і пішов, інакше не дійшов би до лічильника.
    void flush()
  } catch {
    // телеметрія не ламає застосунок
  }
}

/**
 * «Гість відкрив форму реєстрації вчителя» — середина воронки для staff «Сьогодні на сайті»
 * (власник 2026-10-05: «роби подію на відкриття форми реєстрації»). Без неї між «на /start» і
 * «реєстрацій» не видно, де люди відпадають: на лендінгу чи вже на формі.
 *
 * Так само, як візит: одна подія на браузер на київську добу, той самий анонімний id, без PII,
 * шле одразу (людина, що глянула на форму й закрила вкладку, інакше не дійшла б до лічильника).
 */
export function trackRegisterOpen(now: Date = new Date()): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return // автоматизація, не людина
    const day = kyivDay(now)
    try {
      if (localStorage.getItem(REGISTER_DAY_KEY) === day) return
      localStorage.setItem(REGISTER_DAY_KEY, day)
    } catch {
      // localStorage недоступний (приватне вікно) — шлемо без дедупу
    }
    trackEvent(REGISTER_OPEN_EVENT, { anon_id: getAnonId(), route: '/auth/register/tutor' })
    void flush()
  } catch {
    // телеметрія не ламає застосунок
  }
}
