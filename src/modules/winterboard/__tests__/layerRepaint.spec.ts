/**
 * Слідів виділення після зуму не лишається (власник 2026-09-24, P1).
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Сценарій із прода: виділити PDF → змінити масштаб → зняти виділення. На
 * аркуші лишались сині лінії й ручки. Виміряно в браузері: об'єктів на UI-шарі
 * вже немає, а пікселі лишились — шар ніхто не перемалював (подія `resize` або
 * ручний `clearRect` прибирали їх повністю).
 *
 * ІНВАРІАНТИ
 *   INV-REPAINT-1  зміна масштабу → шар перемальовується
 *   INV-REPAINT-2  зняття виділення → шар перемальовується
 *   INV-REPAINT-3  нічого не змінилось → зайвих перемальовувань немає
 *   INV-REPAINT-4  шару ще немає (mount) → без винятку
 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useLayerRepaint } from '../composables/useLayerRepaint'

function harness(layer: { batchDraw?: () => void } | null) {
  const zoom = ref(1)
  const selectedCount = ref(0)
  const Host = defineComponent({
    setup() {
      useLayerRepaint(() => layer, [() => zoom.value, () => selectedCount.value])
      return () => h('div')
    },
  })
  const w = mount(Host)
  return { zoom, selectedCount, w }
}

describe('перемалювання UI-шару', () => {
  it('INV-REPAINT-1: зміна масштабу перемальовує шар', async () => {
    const batchDraw = vi.fn()
    const { zoom } = harness({ batchDraw })
    zoom.value = 1.33
    await nextTick(); await nextTick()
    expect(batchDraw).toHaveBeenCalledTimes(1)
  })

  it('INV-REPAINT-2: зняте виділення перемальовує шар', async () => {
    const batchDraw = vi.fn()
    const { selectedCount } = harness({ batchDraw })
    selectedCount.value = 1
    await nextTick(); await nextTick()
    selectedCount.value = 0
    await nextTick(); await nextTick()
    expect(batchDraw).toHaveBeenCalledTimes(2)
  })

  it('INV-REPAINT-3: без змін шар не чіпаємо', async () => {
    const batchDraw = vi.fn()
    harness({ batchDraw })
    await nextTick(); await nextTick()
    expect(batchDraw).not.toHaveBeenCalled()
  })

  it('INV-REPAINT-4: шару ще немає — тихо, без винятку', async () => {
    const { zoom } = harness(null)
    zoom.value = 2
    await expect((async () => { await nextTick(); await nextTick() })()).resolves.toBeUndefined()
  })
})
