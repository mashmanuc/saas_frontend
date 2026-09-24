/**
 * 2026-09-24: група «— ⛶ ×» сидить у правому краї шапки картки. Картки з власними
 * кнопками в тому ж краї (графік, стереометрія, тригонометричне коло) звільняють
 * рівно заміряну ширину групи — і лише ТА картка, на якій група стоїть.
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { provideHostControlsSlot, useHostControlsReserve, type HostControlsSlot } from '../composables/boardWindowControls'

function setup(slot: ReturnType<typeof ref<HostControlsSlot>>) {
  const got: Record<string, () => number> = {}
  const Card = defineComponent({
    props: { id: { type: String, required: true } },
    setup(p) {
      const r = useHostControlsReserve(() => p.id)
      got[p.id] = () => r.value
      return () => h('div')
    },
  })
  const Host = defineComponent({
    setup() {
      provideHostControlsSlot(slot as never)
      return () => h('div', [h(Card, { id: 'a' }), h(Card, { id: 'b' })])
    },
  })
  mount(Host)
  return got
}

describe('useHostControlsReserve', () => {
  it('місце звільняє лише картка, на якій стоїть група', async () => {
    const slot = ref<HostControlsSlot>({ assetId: 'a', width: 68 })
    const got = setup(slot)
    expect(got.a()).toBe(68)
    expect(got.b()).toBe(0)
    slot.value = { assetId: 'b', width: 164 }
    await nextTick()
    expect(got.a()).toBe(0)
    expect(got.b()).toBe(164)
  })

  it('без полотна (тест окремої картки, V1) — нічого не звільняє', () => {
    let v = -1
    mount(defineComponent({ setup() { const r = useHostControlsReserve(() => 'x'); v = r.value; return () => h('div') } }))
    expect(v).toBe(0)
  })
})
