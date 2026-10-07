/**
 * Б-166 (власник 2026-10-07): «Копіювати зображення» браузера по картинці на дошці.
 *
 * Дошка малює Konva у кількох canvas один над одним; верхній — службовий шар (рамка
 * виділення, ручки), здебільшого прозорий. Правий клік по картинці відкриває меню браузера
 * для canvas під курсором, тобто для ВЕРХНЬОГО шару: «Копіювати зображення» клало в буфер
 * прозорий знімок шару завбільшки з дошку, і вставка давала «рамку без картинки».
 *
 * Тут: на `contextmenu` над картинкою під курсор кладеться невидимий `<img>` з тією самою
 * картинкою (клон елемента, який уже малює Konva, — з кешу, без нового запиту). Chrome
 * будує меню й виконує «Копіювати зображення» / «Зберегти зображення як…» за тим, що лежить
 * під точкою кліку ПІСЛЯ обробників події, тож бере оригінал картинки. Меню браузера
 * лишається тим самим — змінюється лише те, що воно копіює.
 *
 * Чому `contextmenu`, а не натискання кнопки: дошка обробляє натискання будь-якою кнопкою
 * (Konva, `handleMouseDown`), і елемент, підкладений тоді, перехопив би відпускання — дія
 * дошки не завершилась би. `contextmenu` приходить уже після відпускання (Windows/Linux);
 * на macOS — одразу після натискання, але тоді відпускання й так забирає меню.
 * Лише миша: перо й дотик (довге натискання) не чіпаємо — під пером елемент під кінчиком
 * міг би забрати відпускання штриха.
 */
import type { WBAsset } from '../types/winterboard'

/** Розмір невидимого елемента під курсором, px. Меню й копіювання беруть точку кліку. */
export const IMAGE_PROXY_SIZE = 8
/** Рух миші раніше за цей час після `contextmenu` не прибирає елемент (меню ще відкривається). */
export const IMAGE_PROXY_MOVE_GRACE_MS = 250
export const IMAGE_PROXY_ATTR = 'data-wb-image-proxy'

/**
 * Верхній за шарами об'єкт під точкою аркуша — якщо це картинка. Об'єкт будь-якого іншого
 * типу поверх картинки її закриває (тоді null). Поворот — навколо центру, як малює дошка.
 */
export function topImageAssetAt(
  assets: readonly WBAsset[],
  x: number,
  y: number,
): WBAsset | null {
  for (let i = assets.length - 1; i >= 0; i--) {
    const a = assets[i]
    if (!(a.w > 0 && a.h > 0)) continue
    const cx = a.x + a.w / 2
    const cy = a.y + a.h / 2
    const rad = -((a.rotation ?? 0) * Math.PI) / 180
    const dx = x - cx
    const dy = y - cy
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
    if (Math.abs(lx) <= a.w / 2 && Math.abs(ly) <= a.h / 2) {
      return a.type === 'image' ? a : null
    }
  }
  return null
}

export interface ImageContextMenuProxyOptions {
  doc?: Document
  win?: Window
  now?: () => number
}

/**
 * Слухати `contextmenu` на контейнері дошки. `imageAt` повертає вже завантажений елемент
 * картинки під подією (або null). Повертає функцію від'єднання.
 */
export function attachImageContextMenuProxy(
  container: HTMLElement,
  imageAt: (e: MouseEvent) => HTMLImageElement | null,
  options: ImageContextMenuProxyOptions = {},
): () => void {
  const doc = options.doc ?? document
  const win = options.win ?? window
  const now = options.now ?? (() => performance.now())
  let proxy: HTMLImageElement | null = null
  let shownAt = 0

  function removeProxy(): void {
    proxy?.remove()
    proxy = null
  }

  function onContextMenu(e: MouseEvent): void {
    removeProxy()
    const pointerType = (e as PointerEvent).pointerType
    if (pointerType && pointerType !== 'mouse') return
    const source = imageAt(e)
    if (!source || !source.complete || !source.naturalWidth) return

    const img = source.cloneNode(false) as HTMLImageElement
    img.removeAttribute('id')
    img.alt = ''
    img.draggable = false
    img.setAttribute('aria-hidden', 'true')
    img.setAttribute(IMAGE_PROXY_ATTR, '')
    const half = IMAGE_PROXY_SIZE / 2
    img.style.cssText = [
      'position:fixed',
      `left:${e.clientX - half}px`,
      `top:${e.clientY - half}px`,
      `width:${IMAGE_PROXY_SIZE}px`,
      `height:${IMAGE_PROXY_SIZE}px`,
      'margin:0',
      'padding:0',
      'border:0',
      'opacity:0',
      'z-index:2147483647',
      'pointer-events:auto',
    ].join(';')
    doc.body.appendChild(img)
    proxy = img
    shownAt = now()
  }

  // Меню закрилось — наступна дія користувача прибирає елемент. `blur` навмисно не слухаємо:
  // якщо відкрите меню забирає фокус вікна, елемент зник би до «Копіювати зображення».
  function onPointerMove(): void {
    if (proxy && now() - shownAt > IMAGE_PROXY_MOVE_GRACE_MS) removeProxy()
  }

  container.addEventListener('contextmenu', onContextMenu)
  win.addEventListener('pointermove', onPointerMove, true)
  win.addEventListener('pointerdown', removeProxy, true)
  win.addEventListener('keydown', removeProxy, true)
  win.addEventListener('wheel', removeProxy, true)

  return () => {
    container.removeEventListener('contextmenu', onContextMenu)
    win.removeEventListener('pointermove', onPointerMove, true)
    win.removeEventListener('pointerdown', removeProxy, true)
    win.removeEventListener('keydown', removeProxy, true)
    win.removeEventListener('wheel', removeProxy, true)
    removeProxy()
  }
}
