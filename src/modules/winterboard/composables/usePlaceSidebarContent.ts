// usePlaceSidebarContent — touch-«+» альтернатива drag-and-drop для контенту
// сайдбару (файли / сторінки PDF·DOCX / слайди PPTX).
//
// Навіщо: HTML5 drag не працює на тачі, а per-page/slide елементи у
// PdfPageSelector / DocxPageSelector / PresentationSlideSelector були
// drag-only → на телефоні/планшеті їх не можна було поставити на дошку.
// Кімната (WBSoloRoom) провайдить функцію, що кладе payload у центр видимої
// області через contentDrop.handleSidebarDrop; селектори викликають її на «+».
//
// inject default = null → у read-only / без-board контекстах «+» просто no-op
// (компонент не падає).

import { inject, type InjectionKey } from 'vue'
import type { SidebarDragPayload } from '../types/boardDrop'

export const PLACE_SIDEBAR_CONTENT_KEY: InjectionKey<(payload: SidebarDragPayload) => void> =
  Symbol('placeSidebarContent')

export function usePlaceSidebarContent(): ((payload: SidebarDragPayload) => void) | null {
  return inject(PLACE_SIDEBAR_CONTENT_KEY, null)
}
