// Ноутбук: команда пульта `photo.add` (LAW §9 v1.9, 2026-09-26).
//
// Пульт надіслав лише ідентифікатори. Тут ноутбук сам перевіряє актив бібліотеки
// ВІД СВОГО акаунта, завантажує зображення й передає вже розв'язану картинку
// функції розміщення (board/placeImage.ts) — вона про LibraryAsset не знає.
// Жодних повторів запитів кодом (LAW §12): відмова одразу йде на телефон.

import type { ResolvedImage } from '../board/placeImage'
import type { WBPageBackground } from '../types/winterboard'
import { isImageBackground, withImageBackground, withoutImageBackground } from '../board/pageBackground'
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
  /** Дію не можна записати або кімната сама блокує введення */
  isInputLocked: () => boolean
  canAddObject: () => boolean
  /** Чи є об'єкт із таким id на БУДЬ-ЯКІЙ сторінці дошки */
  hasAssetAnywhere: (id: string) => boolean
  fetchLibraryAsset: (id: number) => Promise<PhotoLibraryAsset>
  loadImage: (src: string) => Promise<{ naturalWidth: number; naturalHeight: number }>
  /** Штатне розміщення на поточній сторінці (handleAssetAdd → op asset_add) */
  place: (image: ResolvedImage, id: string) => void
  /** v1.19: фон поточної сторінки (для «Прибрати фон» і ідемпотентності). Без нього — unsupported. */
  currentBackground?: () => WBPageBackground | undefined
  /** v1.19: штатний background_update поточної сторінки */
  setBackground?: (bg: WBPageBackground) => void
}

export interface RemotePhotoAdapter {
  add: (req: RemotePhotoRequest) => Promise<RemotePhotoOutcome>
  /** v1.19: те саме фото — фоном поточної сторінки (ті самі перевірки, що в add). */
  setBackground: (req: RemotePhotoRequest) => Promise<RemotePhotoOutcome>
  /** v1.19: прибрати фото-фон зі сторінки, яку бачив учитель; false — нічого не зроблено. */
  clearBackground: (pageIndex: number) => boolean
  /** v1.19: на поточній сторінці фото-фон (поле `bg_photo` стану пульта). */
  hasBackgroundPhoto: () => boolean
}

/** Куди лягає фото: об'єктом на сторінку (photo.add) чи фоном сторінки (photo.background, v1.19). */
type Mode = 'object' | 'background'

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
  function blocker(pageIndex: number, mode: Mode): PhotoRejectReason | null {
    if (pageIndex !== deps.currentPageIndex()) return 'page_changed'
    if (deps.isInputLocked()) return 'input_locked'
    // фон — не новий об'єкт: стеля об'єктів його не стосується
    if (mode === 'object' && !deps.canAddObject()) return 'limit'
    return null
  }

  /** Цю спробу вже виконано: фото лежить (object) чи вже стоїть фоном поточної сторінки (background). */
  function alreadyDone(req: RemotePhotoRequest, mode: Mode): boolean {
    if (mode === 'object') return deps.hasAssetAnywhere(photoAssetIdFor(req.requestId))
    const bg = deps.currentBackground?.()
    return isImageBackground(bg) && bg.requestId === req.requestId
  }

  async function run(req: RemotePhotoRequest, mode: Mode): Promise<RemotePhotoOutcome> {
    // Студія (шаблон уроку) — не місце для фото з пульта: воно для уроку, який проводять
    if (!deps.supported()) return rejected('unsupported')
    if (mode === 'background' && (!deps.setBackground || !deps.currentBackground)) return rejected('unsupported')
    const id = photoAssetIdFor(req.requestId)
    // Порядок перевірок: дошка → чи фото вже лежить → стан сторінки. Інакше «вже
    // лежить» на перегорнутій сторінці дало б page_changed, і нова спроба — копію.
    const board = deps.boardId()
    if (!board) return rejected('page_changed')
    if (alreadyDone(req, mode)) return { status: 'placed' }
    const pageId = deps.currentPageId()

    const early = blocker(req.pageIndex, mode)
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
    if (alreadyDone(req, mode)) return { status: 'placed' }
    if (deps.currentPageId() !== pageId) return rejected('page_changed')
    const late = blocker(req.pageIndex, mode)
    if (late) return rejected(late)

    if (mode === 'background') {
      // v1.19: те саме перевірене фото — фоном поточної сторінки; попередній фон — у prev
      deps.setBackground!(withImageBackground(deps.currentBackground!(), {
        url: asset.cdn_url, assetId: String(req.libraryAssetId), requestId: req.requestId,
      }))
      return { status: 'placed' }
    }
    deps.place({ src: asset.cdn_url, naturalWidth: dims.naturalWidth, naturalHeight: dims.naturalHeight }, id)
    return { status: 'placed' }
  }

  function start(req: RemotePhotoRequest, mode: Mode): Promise<RemotePhotoOutcome> {
    const key = `${mode}:${req.requestId}`
    const pending = inFlight.get(key)
    if (pending) return pending
    const p = run(req, mode).finally(() => { inFlight.delete(key) })
    inFlight.set(key, p)
    return p
  }

  return {
    add: (req) => start(req, 'object'),
    setBackground: (req) => start(req, 'background'),
    clearBackground(pageIndex) {
      // Лише сторінка, яку бачив учитель, і лише коли запис можливий (як і додавання)
      if (!deps.supported() || !deps.setBackground || !deps.currentBackground) return false
      if (pageIndex !== deps.currentPageIndex() || deps.isInputLocked()) return false
      const bg = deps.currentBackground()
      if (!isImageBackground(bg)) return false
      deps.setBackground(withoutImageBackground(bg))
      return true
    },
    hasBackgroundPhoto: () => deps.supported() && isImageBackground(deps.currentBackground?.()),
  }
}
