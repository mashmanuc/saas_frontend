/**
 * TLV2-03 · капсула V-D3.1 як об'єкт дошки (`visual_capsule`).
 *
 * Обгортка лише передає адресу капсули з `asset.data` у незмінну V-D3.1; тип зареєстровано
 * в усіх списках overlay-типів; сама обгортка нічого не пише в дошку.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import VisualCapsuleAssetRenderer from '../components/board/objects/VisualCapsuleAssetRenderer.vue'
import { OVERLAY_PROXY_TYPES, assetCapabilities } from '../board/objectStandard'
import { OVERLAY_RENDERERS, isOverlayType } from '../components/canvas/overlayRegistry'
import type { WBAsset } from '../types/winterboard'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8')

function capsuleAsset(data: Record<string, unknown>): WBAsset {
  return {
    id: 'cap-1', type: 'visual_capsule', src: '', x: 0, y: 0, w: 780, h: 620,
    rotation: 0, locked: false, data,
  } as unknown as WBAsset
}

function mountAsset(data: Record<string, unknown>, props: Record<string, unknown> = {}) {
  return mount(VisualCapsuleAssetRenderer, {
    props: { asset: capsuleAsset(data), isSelected: false, interactive: true, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })],
      stubs: { Geometry2DRenderer: true },
    },
  })
}

describe('visual_capsule · обгортка над V-D3.1', () => {
  it('рендерить капсулу за visual_id / capsule_version / mode з асета', () => {
    const w = mountAsset({
      version: 1, visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'full',
    })
    const capsule = w.get('[data-testid="visual-capsule"]')
    expect(capsule.attributes('data-visual-id')).toBe('visual.triangles.congruence.overlay')
    expect(capsule.attributes('data-mode')).toBe('full')
    expect(w.find('[data-testid="visual-capsule-error"]').exists()).toBe(false)
    w.unmount()
  })

  it('невідома капсула → видима помилка V-D3.1, не порожній блок', () => {
    const w = mountAsset({ version: 1, visual_id: 'visual.nope', capsule_version: 9, mode: 'full' })
    expect(w.get('[data-testid="visual-capsule-error"]').attributes('role')).toBe('alert')
    w.unmount()
  })

  it('обгортка нічого не пише в дошку: лише UI-події, без store, ops і WS', () => {
    const code = read('modules/winterboard/components/board/objects/VisualCapsuleAssetRenderer.vue')
      .replace(/<!--[\s\S]*?-->/g, '')
    expect(code).not.toMatch(/update:asset|useWBStore|useBoardStore|opsSync|WebSocket|apiClient/)
    // Єдині події — UI-дії картки; сам стан дошки змінює host штатним шляхом.
    expect(code).toContain('defineEmits<{ delete: []; expand: [] }>()')
  })
})

describe('visual_capsule · зареєстровано як overlay-тип', () => {
  it('реєстр, стандарт типів, порівняння асетів і CSS обох шарів', () => {
    expect(isOverlayType('visual_capsule')).toBe(true)
    expect(OVERLAY_RENDERERS.visual_capsule?.component).toBe(VisualCapsuleAssetRenderer)
    // TLV2-05A: переліку типів у WBCanvas більше немає — джерело одне.
    expect(OVERLAY_PROXY_TYPES.has('visual_capsule')).toBe(true)
    expect(read('modules/winterboard/board/state/assetEquality.ts')).toMatch(/'visual_capsule',\s+\/\/ TLV2-03/)
    expect(read('modules/winterboard/components/canvas/WBOverlayLayer.vue')).toContain('.wb-visual-capsule-overlay {')
    expect(read('modules/winterboard/components/canvas/WBCanvas.vue')).toContain('.wb-visual-capsule-overlay {')
  })
})

describe('visual_capsule · стандарт картки (TLV2-05A)', () => {
  const DATA = {
    version: 1, visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'full',
  }

  it('тип оголошує повний набір карткових можливостей', () => {
    expect(assetCapabilities('visual_capsule')).toEqual({
      movable: true, resizable: true, fullscreen: true, duplicable: true,
      deletable: true, lockable: true, layerable: true, minimizable: true,
      contentFit: 'none', textScale: 'none', windowChrome: true,
    })
  })

  it('картка пропускає вказівник до проксі — інакше її не зрушити', () => {
    const code = read('modules/winterboard/components/board/objects/VisualCapsuleAssetRenderer.vue')
    expect(code).toMatch(/\.vcap-card \{[^}]*pointer-events: none/)
    expect(code).toMatch(/\.vcap-card__body \{[^}]*pointer-events: none/)
    // Кнопки капсули лишаються живими навіть коли тіло картки прозоре для подій.
    expect(code).toMatch(/\.vcap-card__body :deep\(\.vcap-btn\) \{\s*pointer-events: auto/)
  })

  it('⛶ згортає і розгортає, × лише вчителю на виділеній картці', () => {
    const w = mountAsset(DATA)
    expect(w.find('.vcap-card__expand').exists()).toBe(true)
    expect(w.find('.vcap-card__delete').exists()).toBe(false)     // не виділена
    w.unmount()

    const selected = mountAsset(DATA, { isSelected: true })
    expect(selected.find('.vcap-card__delete').exists()).toBe(true)
    selected.unmount()

    const student = mountAsset(DATA, { isSelected: true, isTutor: false })
    expect(student.find('.vcap-card__delete').exists()).toBe(false)
    student.unmount()

    const locked = mount(VisualCapsuleAssetRenderer, {
      props: {
        asset: { ...capsuleAsset(DATA), locked: true } as never,
        isSelected: true, interactive: true,
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })],
        stubs: { Geometry2DRenderer: true },
      },
    })
    expect(locked.find('.vcap-card__delete').exists()).toBe(false)
    locked.unmount()
  })

  it('кнопки шапки емітять дії картки і НЕ починають drag (подія не спливає)', async () => {
    const w = mountAsset(DATA, { isSelected: true })
    const root = w.get('.vcap-card').element as HTMLElement
    let bubbled = 0
    root.addEventListener('mousedown', () => { bubbled += 1 })
    root.addEventListener('pointerdown', () => { bubbled += 1 })

    await w.get('.vcap-card__expand').trigger('mousedown')
    await w.get('.vcap-card__expand').trigger('click')
    await w.get('.vcap-card__delete').trigger('mousedown')
    await w.get('.vcap-card__delete').trigger('click')

    expect(bubbled).toBe(0)
    expect(w.emitted('expand')).toHaveLength(1)
    expect(w.emitted('delete')).toHaveLength(1)
    w.unmount()
  })

  it('у режимі малювання кнопки картки інертні', () => {
    const w = mountAsset(DATA, { isSelected: true, interactive: false })
    expect(w.get('.vcap-card').classes()).toContain('is-readonly')
    w.unmount()
  })
})
