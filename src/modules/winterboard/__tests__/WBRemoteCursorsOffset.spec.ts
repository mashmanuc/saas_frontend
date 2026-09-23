/**
 * Рев'ю 75117419: після пану курсор іншого учасника зникав біля правого/нижнього
 * краю — шар курсорів обрізає вміст (overflow: hidden), а зсували весь шар.
 * Тепер шар стоїть, зсув отримує кожен курсор.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WBRemoteCursors from '../components/cursors/WBRemoteCursors.vue'
import type { WBRemoteCursor } from '../types/winterboard'

function cursor(x: number, y: number): WBRemoteCursor {
  return {
    userId: 'u2', displayName: 'Учень', color: '#2563eb',
    x, y, pageId: 'p1', tool: 'pen', lastUpdate: Date.now(),
  } as WBRemoteCursor
}

describe('WBRemoteCursors: зсув аркуша після пану', () => {
  it('курсор зсувається на offset, шар — ні', () => {
    const w = mount(WBRemoteCursors, {
      props: {
        cursors: new Map([['u2', cursor(1000, 500)]]),
        zoom: 2,
        currentPageId: 'p1',
        offsetX: -1500,
        offsetY: -700,
      },
    })
    const layer = w.find('.wb-remote-cursors')
    expect(layer.attributes('style') ?? '').not.toContain('translate')
    // 1000×2 − 1500 = 500; 500×2 − 700 = 300 — у полі, біля краю не обрізається
    expect(w.find('.wb-cursor').attributes('style')).toContain('translate(500px, 300px)')
  })

  it('без пану — як було', () => {
    const w = mount(WBRemoteCursors, {
      props: { cursors: new Map([['u2', cursor(100, 50)]]), zoom: 1, currentPageId: 'p1' },
    })
    expect(w.find('.wb-cursor').attributes('style')).toContain('translate(100px, 50px)')
  })
})
