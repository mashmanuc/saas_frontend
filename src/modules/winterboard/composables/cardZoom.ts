/**
 * Картки з власним полотном на масштабі дошки (власник 2026-10-01).
 *
 * Як у Miro, FigJam, Excalidraw: масштаб дошки зменшує картку цілком, як картинку.
 * Досі накладка мала екранний розмір (`WBCanvas.getOverlayStyle`: розміри × масштаб),
 * а вміст жив у своїх фіксованих пікселях — на 35 % коло стискалось, а підписи ні.
 *
 * Тепер WBCanvas кладе такі картки в обгортку розміром із картку на ДОШЦІ й
 * зменшує її `transform: scale(масштаб)`. Вендор полотна рахує розмітку в пікселях
 * картки (`vendor/cardCanvas.js`), а роздільність — від масштабу показу; коли
 * масштаб змінюється, розмір картки (`clientWidth`) той самий і ResizeObserver
 * мовчить, тож рендерер сам просить нову роздільність (`refreshResolution`).
 */
import { inject, provide, watch, type InjectionKey, type Ref } from 'vue'

/** Типи карток, яких WBCanvas масштабує обгорткою. */
export const ZOOM_SCALED_CARD_TYPES: ReadonlySet<string> = new Set([
  'trig_circle',
  'calculus_card',
  'graph_calculator',
])

const CARD_ZOOM: InjectionKey<Readonly<Ref<number>>> = Symbol('wb-card-zoom')

/** Полотно: поточний масштаб дошки для карток. */
export function provideCardZoom(zoom: Readonly<Ref<number>>): void {
  provide(CARD_ZOOM, zoom)
}

/** Шар накладок: поточний масштаб дошки (поза дошкою — 1, обгортка нічого не змінює). */
export function useCardZoom(): Readonly<Ref<number>> | null {
  return inject(CARD_ZOOM, null)
}

/**
 * Рендерер: масштаб змінився — попросити в рушія нову роздільність. Поза дошкою — нічого.
 * `flush: 'post'` — ПІСЛЯ оновлення DOM: рушій міряє екранний розмір картки, а до
 * оновлення обгортка ще має старий `scale()` (стенд 2026-10-01: графік лишався з
 * роздільністю 35 % на 100 % — розмитий).
 */
export function useCardZoomRefresh(refresh: () => void): void {
  const zoom = inject(CARD_ZOOM, null)
  if (zoom) watch(zoom, () => refresh(), { flush: 'post' })
}

/**
 * Стиль обгортки: розмітка — у пікселях картки (ширина = 100 % / масштаб), показ —
 * масштабом дошки. Розгорнута картка займає полотно у своєму розмірі — без масштабу.
 */
export function cardZoomStyle(zoom: number, expanded: boolean): Record<string, string> {
  const base = { position: 'absolute', left: '0', top: '0' }
  if (expanded || !(zoom > 0) || zoom === 1) return { ...base, width: '100%', height: '100%' }
  return {
    ...base,
    width: `${100 / zoom}%`,
    height: `${100 / zoom}%`,
    transform: `scale(${zoom})`,
    transformOrigin: '0 0',
  }
}
