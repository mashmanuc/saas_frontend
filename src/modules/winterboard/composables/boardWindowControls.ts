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

/**
 * 2026-09-24: спільна група сідає в ПРАВИЙ КРАЙ ШАПКИ картки (не збоку — власник:
 * «як апендицити»). У кількох картках у тому ж краї шапки є власні кнопки
 * (графік, стереометрія, тригонометричне коло) — щоб вони не лягали під групу,
 * полотно повідомляє, скільки місця група займає, і лише на ТІЙ картці, де стоїть.
 * Ширина заміряна з DOM, не вшита: група буває «— ⛶ ×» і «A− 100% A+ │ — ⛶ ×».
 */
export interface HostControlsSlot {
  assetId: string | null
  /** Скільки px праворуч у шапці зайнято групою (0 — нічого). */
  width: number
}

const HOST_CONTROLS_SLOT: InjectionKey<Readonly<Ref<HostControlsSlot>>> = Symbol('wb-host-controls-slot')

/** Полотно: де зараз стоїть група і скільки місця в шапці вона займає. */
export function provideHostControlsSlot(slot: Readonly<Ref<HostControlsSlot>>): void {
  provide(HOST_CONTROLS_SLOT, slot)
}

/** Рендерер: скільки px правого краю шапки звільнити під групу (0 — не на цій картці). */
export function useHostControlsReserve(assetId: () => string): Ref<number> {
  const slot = inject(HOST_CONTROLS_SLOT, null)
  return computed(() => (slot && slot.value.assetId === assetId() ? slot.value.width : 0))
}
