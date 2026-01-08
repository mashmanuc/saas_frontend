import type { LanguageLevel, TutorProfileFull, TutorProfilePatchPayload } from './api/marketplace'

type FormLanguageItem = { code: string; level: LanguageLevel }

// v0.60: Subject form item
type FormSubjectItem = {
  code: string
  tags: string[]
  custom_direction_text: string
}

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
  experience_years: number  // v0.60.1: required by TutorProfileUpdate
  subjects: FormSubjectItem[]  // v0.60: updated to new format
  languages: FormLanguageItem[]
  is_published: boolean  // v0.60.1: profile publication status

  // Privacy
  gender: string
  show_gender: boolean
  birth_year: number | null
  show_age: boolean
  telegram_username: string  // Private field, not shown to students
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

export function fromApi(profile: TutorProfileFull): TutorProfileFormModel {
  // v0.60.1: Parse subjects - ONLY normalized format (SubjectPublic)
  const subjects = Array.isArray(profile?.subjects)
    ? profile.subjects
        .map((s: any) => {
          // Only accept normalized format (SubjectPublic)
          if (s && typeof s === 'object' && s.code) {
            return {
              code: s.code,
              tags: Array.isArray(s.tags) ? s.tags.map((t: any) => t.code || t) : [],
              custom_direction_text: s.custom_direction_text || '',
            }
          }
          // Invalid format - skip
          return null
        })
        .filter((s): s is FormSubjectItem => s !== null)
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

  return {
    headline: asString(profile?.headline).trim(),
    bio: asString(profile?.bio).trim(),
    hourly_rate: asNumber(profile?.pricing?.hourly_rate, 0),
    currency: asString(profile?.pricing?.currency || 'USD').trim() || 'USD',
    trial_lesson_price: asNullableNumber(profile?.pricing?.trial_lesson_price),
    video_intro_url: asString(profile?.media?.video_intro_url).trim(),
    country: asString((profile as any)?.country).trim(),
    timezone: asString(profile?.availability_summary?.timezone).trim(),
    format: (asString((profile as any)?.format).trim() as any) || '',
    experience_years: asNumber(profile?.experience_years, 0),
    subjects,
    languages,
    is_published: asBool((profile as any)?.is_published, false),

    gender: asString((profile as any)?.gender).trim(),
    show_gender: asBool((profile as any)?.show_gender, false),
    birth_year: asNullableNumber((profile as any)?.birth_year),
    show_age: asBool((profile as any)?.show_age, false),
    telegram_username: asString((profile as any)?.telegram_username).trim(),
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
    // v0.60: Updated subjects format (SubjectWritePayload)
    subjects: (model.subjects || []).map((s) => ({
      code: s.code,
      tags: s.tags || [],
      custom_direction_text: s.custom_direction_text || undefined,
    })),
    languages: (model.languages || []).map((l) => ({ code: l.code, level: l.level })),

    gender: model.gender || undefined,
    show_gender: model.show_gender,
    birth_year: model.birth_year,
    show_age: model.show_age,
    telegram_username: model.telegram_username || undefined,
  }

  // Explicitly ensure marketplace write payload does NOT include `photo`.
  delete (payload as any).photo

  return payload as TutorProfilePatchPayload & Record<string, unknown>
}
