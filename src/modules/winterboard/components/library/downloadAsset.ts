/**
 * «⬇ Завантажити» файл із «Матеріалів» (власник 2026-10-29: «чого користувач назад не може скачати собі PDF-файл?»).
 * Файл береться з того самого сховища, звідки його показує дошка (`cdn_url`), і зберігається під своєю назвою.
 * Якщо сховище не віддає файл сторінці (мережа, CORS) — відкриваємо файл у новій вкладці, звідти його можна зберегти.
 */
import type { LibraryAsset } from '../../types/library'

const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

/** Назва файлу для збереження: як у «Матеріалах»; розширення — з назви, адреси файлу або типу. */
export function assetFileName(asset: Pick<LibraryAsset, 'name' | 'cdn_url' | 'content_type'>): string {
  const name = (asset.name || '').trim() || 'file'
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name
  const fromUrl = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(asset.cdn_url || '')?.[1]?.toLowerCase()
  const ext = fromUrl || EXT_BY_TYPE[(asset.content_type || '').toLowerCase()]
  return ext ? `${name}.${ext}` : name
}

/** `saved` — збережено на компʼютер; `opened` — відкрито в новій вкладці (сховище не віддало файл сторінці). */
export async function downloadAsset(asset: Pick<LibraryAsset, 'name' | 'cdn_url' | 'content_type'>): Promise<'saved' | 'opened'> {
  try {
    const res = await fetch(asset.cdn_url, { credentials: 'omit' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = assetFileName(asset)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    return 'saved'
  } catch (err) {
    console.warn('[downloadAsset] сховище не віддало файл — відкриваємо у вкладці', err)
    window.open(asset.cdn_url, '_blank', 'noopener')
    return 'opened'
  }
}
