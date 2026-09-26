// Ноутбук: команда пульта `photo.add` (LAW §9 v1.9, 2026-09-26).
//
// Пульт надіслав лише ідентифікатори. Тут ноутбук сам перевіряє актив бібліотеки
// ВІД СВОГО акаунта, завантажує зображення й передає вже розв'язану картинку
// функції розміщення (board/placeImage.ts) — вона про LibraryAsset не знає.
// Жодних повторів запитів кодом (LAW §12): відмова одразу йде на телефон.

import type { ResolvedImage } from '../board/placeImage'
import {
  PHOTO_MIME_TYPES, photoAssetIdFor,
  type PhotoRejectReason, type RemotePhotoOutcome, type RemotePhotoRequest,
} from './photoContract'

/** Те, що ноутбукові треба знати про актив бібліотеки (відповідь GET /library/assets/{id}/). */
export interface PhotoLibraryAsset {
  status: string
  content_type: string
  cdn_url: string
  /** Є лише в активів зі штатного завантаження (файл пройшов сховище й квоту) */
  content_item_id?: number | null
}

export interface RemotePhotoDeps {
  /**
   * Чи ця дошка — урок, який проводять (після «Провести»), а не шаблон у Студії.
   * Пульт підключається лише до уроку; у шаблон фото з пульта не кладемо.
   */
  supported: () => boolean
  /**
   * Id дошки, яку зараз тримає стор. Стор глобальний: поки вантажилось фото, вчитель
   * міг перейти на іншу дошку — тоді класти не можна, навіть якщо номер сторінки збігся.
   */
  boardId: () => string | null
  /** Id поточної сторінки: видалена сторінка лишає той самий номер, але це вже інша сторінка */
  currentPageId: () => string | null
  currentPageIndex: () => number
  /** Дошка з фіналізованим записом (REPLAY_FROZEN_NO_WRITE) */
  isFrozen: () => boolean
  /** Дію не можна записати або кімната сама блокує введення */
  isInputLocked: () => boolean
  canAddObject: () => boolean
  /** Чи є об'єкт із таким id на БУДЬ-ЯКІЙ сторінці дошки */
  hasAssetAnywhere: (id: string) => boolean
  fetchLibraryAsset: (id: number) => Promise<PhotoLibraryAsset>
  loadImage: (src: string) => Promise<{ naturalWidth: number; naturalHeight: number }>
  /** Штатне розміщення на поточній сторінці (handleAssetAdd → op asset_add) */
  place: (image: ResolvedImage, id: string) => void
}

export interface RemotePhotoAdapter {
  add: (req: RemotePhotoRequest) => Promise<RemotePhotoOutcome>
}

function rejected(reason: PhotoRejectReason): RemotePhotoOutcome {
  return { status: 'rejected', reason }
}

function httpStatus(err: unknown): number | null {
  const s = (err as { response?: { status?: unknown } } | null)?.response?.status
  return typeof s === 'number' ? s : null
}

export function createRemotePhotoAdapter(deps: RemotePhotoDeps): RemotePhotoAdapter {
  /** Та сама спроба, що вже в роботі, другого додавання не запускає */
  const inFlight = new Map<string, Promise<RemotePhotoOutcome>>()

  /** Стан дошки, за якого класти фото не можна. Перевіряється і до, і після очікувань. */
  function blocker(pageIndex: number): PhotoRejectReason | null {
    if (pageIndex !== deps.currentPageIndex()) return 'page_changed'
    if (deps.isFrozen()) return 'frozen'
    if (deps.isInputLocked()) return 'input_locked'
    if (!deps.canAddObject()) return 'limit'
    return null
  }

  async function run(req: RemotePhotoRequest): Promise<RemotePhotoOutcome> {
    // Студія (шаблон уроку) — не місце для фото з пульта: воно для уроку, який проводять
    if (!deps.supported()) return rejected('unsupported')
    const id = photoAssetIdFor(req.requestId)
    // Порядок перевірок: дошка → чи фото вже лежить → стан сторінки. Інакше «вже
    // лежить» на перегорнутій сторінці дало б page_changed, і нова спроба — копію.
    const board = deps.boardId()
    if (!board) return rejected('page_changed')
    if (deps.hasAssetAnywhere(id)) return { status: 'placed' }
    const pageId = deps.currentPageId()

    const early = blocker(req.pageIndex)
    if (early) return rejected(early)

    let asset: PhotoLibraryAsset
    try {
      asset = await deps.fetchLibraryAsset(req.libraryAssetId)
    } catch (err) {
      const status = httpStatus(err)
      // чужий чи видалений актив сервер віддає як 404 (фільтр tutor=request.user)
      if (status === 404 || status === 403) return rejected('not_found')
      console.warn('[WB:remote-photo] library asset check failed:', status ?? err)
      return rejected('error')
    }
    if (!asset || asset.status !== 'active' || typeof asset.cdn_url !== 'string' || !asset.cdn_url) {
      return rejected('not_found')
    }
    if (!PHOTO_MIME_TYPES.has(String(asset.content_type || '').toLowerCase())) return rejected('not_image')
    // Лише файл зі штатного завантаження (ТЗ §3.4): не «метадані» з довільним cdn_url
    if (!asset.content_item_id) return rejected('not_image')

    let dims: { naturalWidth: number; naturalHeight: number }
    try {
      dims = await deps.loadImage(asset.cdn_url)
    } catch (err) {
      console.warn('[WB:remote-photo] image did not load:', err)
      return rejected('load_failed')
    }

    // Поки вантажилось, дошку могли змінити (стор спільний), фото — вже покласти
    // (інша вкладка цієї ж дошки), а сторінку — перегорнути чи видалити.
    if (deps.boardId() !== board) return rejected('page_changed')
    if (deps.hasAssetAnywhere(id)) return { status: 'placed' }
    if (deps.currentPageId() !== pageId) return rejected('page_changed')
    const late = blocker(req.pageIndex)
    if (late) return rejected(late)

    deps.place({ src: asset.cdn_url, naturalWidth: dims.naturalWidth, naturalHeight: dims.naturalHeight }, id)
    return { status: 'placed' }
  }

  return {
    add(req) {
      const pending = inFlight.get(req.requestId)
      if (pending) return pending
      const p = run(req).finally(() => { inFlight.delete(req.requestId) })
      inFlight.set(req.requestId, p)
      return p
    },
  }
}
