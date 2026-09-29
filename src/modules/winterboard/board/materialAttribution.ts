/**
 * LAW §9 v1.22 (власник 2026-09-29): джерело матеріалу на дошці — маленька кнопка
 * «Джерело», а не рядок у тексті картки чи підпис під картинкою. Повна атрибуція
 * (назва, автор, посилання, ліцензія) — за натиском; у PNG/PDF — текстом під сторінкою
 * (сервер, INV-EP-9), бо CC BY-SA вимагає її в самому файлі.
 *
 * ДАНІ НЕ ЗМІНЮЮТЬСЯ. TASL-рядок лишається в `body` картки (гейт H0: після reload і
 * replay текст той самий), змінюється лише показ. Правило «який рядок — атрибуція»
 * одне на FE і BE: дзеркало — `apps/winterboard/services/export_attribution.py`
 * (`split_card_attribution`). Розійдуться — рядок зникне і з дошки, і з PDF.
 */
import type { WBAsset, WBSourceRef } from '../types/winterboard'

export type MaterialLanguage = 'uk' | 'en'

// Підпис рядка атрибуції — `material_label(lang, 'source')` на BE (обидві мови матеріалу).
const ATTRIBUTION_PREFIX = /^(Джерело|Source): /
// Картка поза rollout-гейтом коридорів — тобто в УСІХ учителів, крім пілотного акаунта:
// сервер дописує в `body` саме цей рядок і `sources[]` не дає (parser.py `_r_wiki_lookup`,
// поза гейтом parse байт-у-байт як до коридорів).
const LEGACY_WIKI_LINE = /^Джерело: Вікіпедія — (https?:\/\/\S+)$/
const WEB_URL = /^https?:\/\/.+/i

/** Справжнє веб-посилання — лише воно стає клікабельним (не `javascript:` з чужих даних). */
export const isWebUrl = (url: unknown): url is string => typeof url === 'string' && WEB_URL.test(url.trim())

export interface CardAttributionSplit {
  /** Текст для показу — без рядка атрибуції. */
  text: string
  /** Сам рядок атрибуції; порожньо — рядка не впізнано, текст як є. */
  attribution: string
  /** Адреса джерела з цього рядка. */
  url: string
}

/**
 * Текст картки без кінцевого рядка атрибуції — останнього абзацу з одного рядка, коли він:
 *  • з `sources[]`: починається з «Джерело: »/«Source: » і містить адресу одного з джерел
 *    (TASL коридору: назва, автор, адреса, ліцензія);
 *  • без `sources[]`: рівно `Джерело: Вікіпедія — <адреса>` (картка поза гейтом коридорів).
 * Інакше текст лишається як є: відредагований чи чужий абзац зберігає атрибуцію видимою.
 */
export function splitCardAttribution(body: unknown, sources: unknown): CardAttributionSplit {
  const text = typeof body === 'string' ? body : ''
  const asIs = { text, attribution: '', url: '' }
  const cut = text.lastIndexOf('\n\n')
  if (cut < 0) return asIs
  const tail = text.slice(cut + 2).trim()
  if (!tail || tail.includes('\n')) return asIs
  const split = (url: string) => ({ text: text.slice(0, cut).trimEnd(), attribution: tail, url })
  const refs = Array.isArray(sources) ? sources : []
  if (refs.length) {
    if (!ATTRIBUTION_PREFIX.test(tail)) return asIs
    for (const ref of refs) {
      const url = (ref as Partial<WBSourceRef> | null)?.url
      if (isWebUrl(url) && tail.includes(url.trim())) return split(url.trim())
    }
    return asIs
  }
  const legacy = LEGACY_WIKI_LINE.exec(tail)
  return legacy ? split(legacy[1]) : asIs
}

/** Адреса для очей: `%D0%86…` → `І…`. Зіпсоване кодування — як є. */
export function readableUrl(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

/** Службові підписи мовою МАТЕРІАЛУ, не інтерфейсу (дзеркало `material_labels.py`). */
export const SOURCE_BADGE_LABELS: Record<MaterialLanguage, {
  source: string; author: string; license: string; commons: string
}> = {
  uk: { source: 'Джерело', author: 'Автор', license: 'Ліцензія', commons: 'Вікісховище' },
  en: { source: 'Source', author: 'Author', license: 'License', commons: 'Wikimedia Commons' },
}

export interface ImageSource {
  language: MaterialLanguage
  /** Назва твору: файл на Commons (провенанс коридору), інакше назва статті. */
  title: string
  url: string
  author: string
  license: string
  licenseUrl: string
  /** Людська назва провайдера мовою матеріалу; порожньо — невідомий. */
  provider: string
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/**
 * Джерело картинки від Інтегралика (`add_image`). Є лише там, де в даних справжнє
 * веб-посилання: картинка, яку вчитель вставив сам, значка не має.
 */
export function imageSource(asset: Pick<WBAsset, 'type' | 'data'>): ImageSource | null {
  if (asset.type !== 'image') return null
  // У типі WBAsset немає даних картинки — це дані `add_image`, читаємо їх як запис.
  const data = (asset.data ?? null) as unknown as Record<string, unknown> | null
  if (!data || !isWebUrl(data.source_url)) return null
  const provenance = (data.provenance && typeof data.provenance === 'object'
    ? data.provenance : {}) as Record<string, unknown>
  const language: MaterialLanguage = data.content_language === 'en' ? 'en' : 'uk'
  return {
    language,
    title: str(provenance.source_title) || str(data.caption),
    url: str(data.source_url),
    author: str(data.author),
    license: str(data.license),
    licenseUrl: isWebUrl(provenance.license_url) ? str(provenance.license_url) : '',
    provider: data.source === 'wikimedia_commons' ? SOURCE_BADGE_LABELS[language].commons : '',
  }
}
