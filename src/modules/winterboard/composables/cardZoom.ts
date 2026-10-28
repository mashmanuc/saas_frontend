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
import { inject, onBeforeUnmount, provide, watch, type InjectionKey, type Ref } from 'vue'

/** Типи карток, яких WBCanvas масштабує обгорткою. */
export const ZOOM_SCALED_CARD_TYPES: ReadonlySet<string> = new Set([
  'trig_circle',
  'calculus_card',
  'graph_calculator',
  // «Наочна сцена» (2026-10-20): сцена у вікні верстається в пікселях картки — вужче за 820 px вона
  // перебудовується «картинка над текстом» і дає прокрутку; так вона завжди та сама, лише менша.
  'math_scene',
  // Тіло (28.10): 3D-об'єкт малює сцену в пікселях картки — знімок для експорту не залежить від масштабу дошки.
  'nmt3d',
])

/**
 * Картка конспекту теми (власник 2026-10-21: «так, роби конспекти картками») — текстова картка, яку генератор
 * поклав на сторінку конспекту разом із сусідами (`data.konspekt` = slug конспекту). Сторінка конспекту — як
 * сторінка книжки: зменшується цілком, як графік, і НЕ підганяє висоту сама — інакше на меншому екрані текст
 * лишався б того самого розміру, картка росла б донизу й налазила на сусідню (стенд 2026-10-21, масштаб 67 %).
 * Решта текстових карток — як і були.
 */
export function isKonspektCard(asset: { type?: string; data?: unknown } | null | undefined): boolean {
  if (!asset || asset.type !== 'theory_card') return false
  const slug = (asset.data as { konspekt?: unknown } | null | undefined)?.konspekt
  return typeof slug === 'string' && slug.length > 0
}

/**
 * Картка задачі (власник 2026-10-21, «роби»: задачі на 200 % на маленьких екранах). Текст задачі мав екранний
 * розмір, а аркуш зменшувався: на ноутбуці 1366×768 (масштаб 0,47) картка на 200 % ставила варіанти в стовпчик і
 * виходила за низ сторінки. Тепер вона — зменшена копія самої себе: на проєкторі й на ноутбуці та сама розкладка,
 * лише менша. Висоту підганяє як і раніше (INV-25), але міряє в пікселях картки (`fitMeasureZoom`).
 */
export const ZOOM_SCALED_TEXT_CARD_TYPES: ReadonlySet<string> = new Set(['nmt_task'])

/**
 * «Музейна етикетка» (власник 2026-10-21) — картка людини за дизайном: портрет 340 px поруч із текстом, кеглі
 * заголовка 40 px. Це композиція, а не потік тексту: на масштабі 0,5 з екранними кеглями колонка тексту
 * лишалась би вузькою смужкою. Тож вона, як картка задачі, — зменшена копія самої себе; висоту підганяє (INV-25).
 */
export function isMuseumCard(asset: { type?: string; data?: unknown } | null | undefined): boolean {
  if (!asset || asset.type !== 'history_card') return false
  const museum = (asset.data as { museum?: unknown } | null | undefined)?.museum
  return !!museum && typeof museum === 'object'
}

/** Картку показуємо зменшеною копією самої себе: за типом, як картку конспекту або як музейну етикетку. */
export function isZoomScaledCard(asset: { type?: string; data?: unknown } | null | undefined): boolean {
  if (!asset) return false
  const type = asset.type ?? ''
  return ZOOM_SCALED_CARD_TYPES.has(type) || ZOOM_SCALED_TEXT_CARD_TYPES.has(type) || isKonspektCard(asset)
    || isMuseumCard(asset)
}

/**
 * Масштаб, у якому виміряна висота вмісту переводиться в координати дошки (`nextAutoFitHeight`): звичайна картка
 * міряє екранні пікселі (ділимо на масштаб), зменшена копія — пікселі самої картки, вони вже й є координати дошки.
 */
export function fitMeasureZoom(asset: { type?: string; data?: unknown } | null | undefined, zoom: number): number {
  return isZoomScaledCard(asset) ? 1 : zoom
}

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
export function useCardZoomRefresh(refresh: () => void, renderNow: () => void = refresh): void {
  const zoom = inject(CARD_ZOOM, null)
  if (zoom) watch(zoom, () => refresh(), { flush: 'post' })
  // Підготовка експорту (prepareCardExport) — нова роздільність ОДРАЗУ (знімання не чекає кадру: у фоновій
  // вкладці кадрів немає), без зміни даних картки.
  if (typeof window === 'undefined') return
  const onExport = () => renderNow()
  window.addEventListener(CARD_EXPORT_EVENT, onExport)
  onBeforeUnmount(() => window.removeEventListener(CARD_EXPORT_EVENT, onExport))
}

/**
 * Позначка «готуємо експорт» на `<html>`: полотна карток (`vendor/cardCanvas.js`, той самий рядок) на цей час
 * малюються в роздільності 100 %, хоч би який масштаб дошки. Без неї на 18 % інтеграл/графік/коло у PDF
 * були розмиті (стенд 2026-10-28) — полотно тримає роздільність показу.
 */
export const CARD_EXPORT_ATTR = 'data-card-export'
/** Подія: позначку поставлено/знято — картки перемальовуються (useCardZoomRefresh). */
export const CARD_EXPORT_EVENT = 'wb:card-export-resolution'

/**
 * Сервіс експорту — ДО знімання: позначка + перемальовування карток (одразу, синхронно). Повертає «прибрати»
 * (у finally — і при збої, і при скасуванні). Дані карток, камера, масштаб дошки, операції й запис не змінюються;
 * функції знімання віджетів лишаються тонкими (INV-EP-8).
 */
export function prepareCardExport(): () => void {
  if (typeof document === 'undefined') return () => {}
  const root = document.documentElement
  root.setAttribute(CARD_EXPORT_ATTR, '')
  window.dispatchEvent(new Event(CARD_EXPORT_EVENT))
  return () => {
    root.removeAttribute(CARD_EXPORT_ATTR)
    window.dispatchEvent(new Event(CARD_EXPORT_EVENT))
  }
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
