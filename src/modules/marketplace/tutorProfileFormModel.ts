import type { LanguageLevel, TutorProfile, TutorProfilePatchPayload } from './api/marketplace'

type FormLanguageItem = { code: string; level: LanguageLevel }

export type TutorProfileFormModel = {
  headline: string
  bio: string
  hourly_rate: number
  currency: string
  trial_lesson_price: number | null
  video_intro_url: string
  country: string
  timezone: string
  format: 'online' | 'offline' | 'hybrid' | ''
  subjects: string[]
  languages: FormLanguageItem[]

  // Privacy
  gender: string
  show_gender: boolean
  birth_year: number | null
  show_age: boolean
  telegram_username: string
  show_telegram: boolean

  // Certifications (text-only)
  certifications: Array<{ name: string; issuer: string; is_public: boolean }>
}

function asString(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function asNullableNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

function uniqueStrings(items: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const it of items) {
    const s = asString(it).trim()
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export function fromApi(profile: TutorProfile): TutorProfileFormModel {
  const subjects = Array.isArray(profile?.subjects)
    ? uniqueStrings(profile.subjects.map((s: any) => s?.code ?? s?.slug ?? s?.name ?? s))
    : []

  const languages = Array.isArray(profile?.languages)
    ? (profile.languages
        .map((l: any) => {
          const code = asString(l?.code).trim()
          const level = (l?.level || 'fluent') as LanguageLevel
          if (!code) return null
          return { code, level }
        })
        .filter(Boolean) as FormLanguageItem[])
    : []

  const certifications = Array.isArray((profile as any)?.certifications)
    ? ((profile as any).certifications
        .map((c: any) => {
          const name = asString(c?.name).trim()
          const issuer = asString(c?.issuer).trim()
          if (!name && !issuer) return null
          return {
            name,
            issuer,
            is_public: asBool(c?.is_public, true),
          }
        })
        .filter(Boolean) as Array<{ name: string; issuer: string; is_public: boolean }>)
    : []

  return {
    headline: asString(profile?.headline).trim(),
    bio: asString(profile?.bio).trim(),
    hourly_rate: asNumber((profile as any)?.hourly_rate, 0),
    currency: asString((profile as any)?.currency || 'USD').trim() || 'USD',
    trial_lesson_price: asNullableNumber((profile as any)?.trial_lesson_price),
    video_intro_url: asString((profile as any)?.video_intro_url).trim(),
    country: asString((profile as any)?.country).trim(),
    timezone: asString((profile as any)?.timezone).trim(),
    format: (asString((profile as any)?.format).trim() as any) || '',
    subjects,
    languages,

    gender: asString((profile as any)?.gender).trim(),
    show_gender: asBool((profile as any)?.show_gender, false),
    birth_year: asNullableNumber((profile as any)?.birth_year),
    show_age: asBool((profile as any)?.show_age, false),
    telegram_username: asString((profile as any)?.telegram_username).trim(),
    show_telegram: asBool((profile as any)?.show_telegram, false),

    certifications,
  }
}

export function toApi(model: TutorProfileFormModel): TutorProfilePatchPayload & Record<string, unknown> {
  const payload: Record<string, unknown> = {
    headline: model.headline || '',
    bio: model.bio || '',
    hourly_rate: model.hourly_rate,
    currency: model.currency || 'USD',
    trial_lesson_price: model.trial_lesson_price,
    video_intro_url: model.video_intro_url || undefined,
    country: model.country || undefined,
    timezone: model.timezone || undefined,
    format: model.format || undefined,
    subjects: (model.subjects || []).map((code) => ({ code })),
    languages: (model.languages || []).map((l) => ({ code: l.code, level: l.level })),

    gender: model.gender || undefined,
    show_gender: model.show_gender,
    birth_year: model.birth_year,
    show_age: model.show_age,
    telegram_username: model.telegram_username || undefined,
    show_telegram: model.show_telegram,

    certifications: (model.certifications || []).map((c) => ({
      name: c.name,
      issuer: c.issuer,
      is_public: c.is_public,
    })),
  }

  // Explicitly ensure marketplace write payload does NOT include `photo`.
  delete (payload as any).photo

  return payload as TutorProfilePatchPayload & Record<string, unknown>
}
