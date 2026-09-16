/**
 * TLV2-05B.2 · хто малює віконні дії картки (⛶ / ×): сама картка чи полотно.
 *
 * Історично кожен рендерер малював власні ⛶ і × — у різних місцях шапки, з різними
 * умовами. У режимі стандарту карток (прапорець трею, TLV2) полотно показує ОДНУ
 * спільну групу «— ⛶ ×» у правому верхньому куті виділеної картки
 * (`WBCardWindowControls`), а рендерер свої ⛶/× не малює — інакше кнопок було б дві.
 *
 * Без провайдера (V1, тести окремої картки) — `false`: картка поводиться як раніше.
 */
import { computed, inject, provide, type InjectionKey, type Ref } from 'vue'

const HOST_WINDOW_CONTROLS: InjectionKey<Ref<boolean>> = Symbol('wb-host-window-controls')

/** Полотно: «віконні дії карток малюю я». */
export function provideHostWindowControls(enabled: () => boolean): void {
  provide(HOST_WINDOW_CONTROLS, computed(enabled))
}

/** Рендерер: чи сховати власні ⛶/×, бо їх показує спільна група полотна. */
export function useHostWindowControls(): Ref<boolean> {
  return inject(HOST_WINDOW_CONTROLS, computed(() => false))
}
