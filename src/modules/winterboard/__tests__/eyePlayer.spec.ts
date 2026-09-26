/**
 * EyePlayer — око зі стартового екрана публічного реплею, з 2026-09-27 ще й на лендингу.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Власник: «я думав там у вікні зразу буде наше око з реплея». Око винесли з
 * WBPublicView в компонент, і в нього стало два місця з різними вимогами:
 *   INV-EYE-1  без `captureTouch` палець на документі НЕ перехоплюється — інакше
 *              лендинг на телефоні не гортається (око ловить touchmove з preventDefault);
 *   INV-EYE-2  з `captureTouch` — перехоплюється, як на реплеї до винесення;
 *   INV-EYE-3  промінці райдужки є і в нерухомого ока (у в'юсі старт випереджав
 *              розмітку — на проді промінців було 0);
 *   INV-EYE-4  `active` вмикає/вимикає слухачі документа, демонтаж прибирає все;
 *   INV-EYE-5  клік падає на обгортку — реплей стартує, посилання лендингу спрацьовує;
 *   INV-EYE-6  id у SVG свої для кожного ока (інакше друге брало б рухомий clipPath першого).
 * Плюс сторожі розмітки: як око стоїть на реплеї (capture-touch + @click) і на лендингу (без).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h } from 'vue'
import EyePlayer from '../components/public/EyePlayer.vue'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')

const raysGroup = (el: Element) =>
  [...el.querySelectorAll('g')].find(g => (g.getAttribute('clip-path') || '').startsWith('url(#ep-irisClip-'))!
const rays = (w: ReturnType<typeof mount>) => raysGroup(w.element).querySelectorAll('path').length

function touchmove(): TouchEvent {
  const ev = new Event('touchmove', { cancelable: true, bubbles: true }) as TouchEvent
  Object.defineProperty(ev, 'touches', { value: [{ clientX: 10, clientY: 10 }] })
  document.dispatchEvent(ev)
  return ev
}

afterEach(() => vi.restoreAllMocks())

describe('EyePlayer', () => {
  it('INV-EYE-1: за замовчуванням палець не перехоплюється — сторінка гортається', () => {
    const w = mount(EyePlayer, { attachTo: document.body })
    expect(touchmove().defaultPrevented).toBe(false)
    w.unmount()
  })

  it('INV-EYE-2: captureTouch — перехоплюється, як на реплеї', () => {
    const w = mount(EyePlayer, { props: { captureTouch: true }, attachTo: document.body })
    expect(touchmove().defaultPrevented).toBe(true)
    w.unmount()
    // після демонтажу — знову ні
    expect(touchmove().defaultPrevented).toBe(false)
  })

  it('INV-EYE-3: промінці райдужки є і в живого, і в нерухомого ока, без дублів', async () => {
    const live = mount(EyePlayer)
    expect(rays(live)).toBe(40)
    const still = mount(EyePlayer, { props: { active: false } })
    expect(rays(still)).toBe(40)
    await still.setProps({ active: true })
    await still.setProps({ active: false })
    await still.setProps({ active: true })
    expect(rays(still)).toBe(40)
    live.unmount(); still.unmount()
  })

  it('INV-EYE-4: active керує слухачами документа, демонтаж прибирає все', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const moves = (spy: typeof add) => spy.mock.calls.filter(c => c[0] === 'mousemove').length
    const w = mount(EyePlayer, { props: { active: false } })
    expect(moves(add)).toBe(0)
    await w.setProps({ active: true })
    expect(moves(add)).toBe(1)
    await w.setProps({ active: false })
    expect(moves(remove)).toBe(1)
    await w.setProps({ active: true })
    expect(moves(add)).toBe(2)
    w.unmount()
    expect(moves(remove)).toBe(2)
  })

  it('INV-EYE-4: нерухоме око при демонтажі нічого не знімає (зупинка лише запущеного)', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const w = mount(EyePlayer, { props: { active: false } })
    w.unmount()
    expect(remove.mock.calls.filter(c => c[0] === 'mousemove')).toHaveLength(0)
  })

  it('INV-EYE-6: два ока на сторінці — у кожного свої id, промінці обрізає власний clipPath', () => {
    // Одна сторінка = один застосунок Vue (у двох окремих mount() лічильник useId свій)
    const page = mount(defineComponent({ setup: () => () => h('div', [h(EyePlayer), h(EyePlayer)]) }))
    const [a, b] = [...page.element.querySelectorAll('.eye-player')]
    const clipOf = (el: Element) => raysGroup(el).getAttribute('clip-path')!.slice('url(#'.length, -1)
    expect(clipOf(a)).not.toBe(clipOf(b))
    for (const el of [a, b]) {
      expect(el.querySelector(`clipPath[id="${clipOf(el)}"]`)).not.toBeNull()
    }
    page.unmount()
  })

  it('INV-EYE-5: клік по оку доходить до батька', async () => {
    const onClick = vi.fn()
    const w = mount(EyePlayer, { attrs: { onClick, class: 'wb-public-view__hero-eye' } })
    expect(w.classes()).toContain('wb-public-view__hero-eye')
    await w.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})

describe('хто як ставить око (сторожі розмітки)', () => {
  // WBPublicView не монтується в жодному тесті (важкий), тож тримаємо рядок використання:
  // без @click реплей не стартує, без capture-touch змінилась би поведінка на телефоні.
  it('реплей: клік запускає відтворення, палець перехоплюється, як до винесення', () => {
    expect(read('modules/winterboard/views/WBPublicView.vue'))
      .toContain('<EyePlayer class="wb-public-view__hero-eye" capture-touch @click="handleHeroPlay" />')
  })

  it('лендинг: палець НЕ перехоплюється — інакше сторінку на телефоні не прогорнути', () => {
    const landing = read('views/RoleSelectionView.vue')
    const usage = landing.match(/<EyePlayer[^>]*\/>/g) ?? []
    expect(usage).toHaveLength(1)
    expect(usage[0]).not.toMatch(/capture-touch|captureTouch/)
  })
})
