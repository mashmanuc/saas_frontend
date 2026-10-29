/**
 * Шкала «вісь» за макетом дизайнера (власник 2026-10-29: «Роби за макетом дизайнера, лише для мене»).
 *
 * ЩО СТЕРЕЖУТЬ ЦІ ТЕСТИ
 *
 * 1. ВИГЛЯД ЗА ДАНИМИ. `data.view === 'axis'` — вісь, етапи, фішки, картка події; без поля — старий список
 *    (старі шкали на дошках не змінюються).
 * 2. ОДИН ШТАТНИЙ ЗАПИС. Вибір події — рівно один `update:asset` з `active_event_id`; натиск на вже
 *    відкриту подію нічого не пише; «Перевір себе» не пише нічого (лише цей екран, LAW §9 v1.71).
 * 3. ВІСЬ У МАСШТАБІ ЧАСУ. Відстань між точками пропорційна рокам, а не порядку.
 * 4. ЧЕСНІСТЬ ПЕРЕВІРКИ. У «Перевір себе» дати сховані до відповіді; правильна дата — серед варіантів.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import TimelineCardRenderer from '../components/board/objects/TimelineCardRenderer.vue'
import type { WBAsset } from '../types/winterboard'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const ev = (id: string, year: number, label: string, extra: Record<string, unknown> = {}) => ({
  id, date_start: { year, precision: 'year' }, date_end: null, label, description: `Текст про ${label}.`,
  place_ids: [], image: null, sources: [], ...extra,
})

function axisAsset(data: Record<string, unknown> = {}): WBAsset {
  return {
    id: 'tl1', type: 'timeline_card', src: '', x: 0, y: 0, w: 1120, h: 640, rotation: 0, locked: false,
    data: {
      version: 1, title: 'Річ Посполита', layout: 'ordinal', orientation: 'horizontal', view: 'axis',
      eras: [{ name: 'Унії', from: 1385, to: 1596 }, { name: 'Поділи', from: 1772, to: 1795 }],
      events: [
        ev('event-1', 1385, 'Кревська унія', { era: 0, kind: 'унія', participants: ['Польща', 'ВКЛ'] }),
        ev('event-2', 1569, 'Люблінська унія', { era: 0, kind: 'унія' }),
        ev('event-3', 1772, 'Перший поділ', { era: 1, kind: 'поділ' }),
        ev('event-4', 1794, 'Повстання Костюшка', {
          era: 1, date_start: { year: 1794, month: 3, day: 24, precision: 'day' },
          date_end: { year: 1794, month: 11, day: 16, precision: 'day' } }),
        ev('event-5', 1795, 'Третій поділ', { era: 1 }),
      ],
      active_event_id: 'event-1', sources: [], ...data,
    },
  } as unknown as WBAsset
}

const mountCard = (asset: WBAsset, interactive = true) => mount(TimelineCardRenderer, {
  props: { asset, isSelected: false, interactive },
  global: { plugins: [i18n()] },
})

const left = (el: Element) => parseFloat((el as HTMLElement).style.left)

afterEach(() => { vi.useRealTimers() })

describe('вигляд за даними', () => {
  it('view: axis — вісь, етапи, фішки й картка події', () => {
    const w = mountCard(axisAsset())
    expect(w.find('[data-testid="timeline-axis"]').exists()).toBe(true)
    expect(w.findAll('.tl-axis__era').map(e => e.text())).toEqual(['Унії', 'Поділи'])
    expect(w.findAll('.tl-axis__dot')).toHaveLength(5)
    expect(w.findAll('.tl-axis__chip')).toHaveLength(5)
    expect(w.find('[data-testid="timeline-axis-big"]').text()).toBe('1385')
    expect(w.find('.tl-axis__text').text()).toBe('Текст про Кревська унія.')
    expect(w.find('.tl-axis__who').text()).toContain('Польща')
    expect(w.find('.timeline-card__years').text()).toBe('1385 — 1795')
    expect(w.find('.timeline-card__axis').exists()).toBe(false)
  })

  it('без view — старий список, як і на всіх наявних дошках', () => {
    const asset = axisAsset()
    delete (asset.data as Record<string, unknown>).view
    const w = mountCard(asset)
    expect(w.find('[data-testid="timeline-axis"]').exists()).toBe(false)
    expect(w.find('.timeline-card__axis').exists()).toBe(true)
  })

  it('період: велика дата «початок–кінець», повна — окремим рядком', async () => {
    const w = mountCard(axisAsset({ active_event_id: 'event-4' }))
    expect(w.find('[data-testid="timeline-axis-big"]').text()).toBe('1794')
    expect(w.find('.tl-axis__full').text()).toBe('24 березня 1794 — 16 листопада 1794')
  })

  it('вид і етап події — мітками', () => {
    const w = mountCard(axisAsset({ active_event_id: 'event-3' }))
    expect(w.findAll('.tl-axis__tag').map(t => t.text())).toEqual(['Поділи', 'поділ'])
  })
})

describe('вісь у масштабі часу', () => {
  it('відстань між точками пропорційна рокам, а не порядку', () => {
    const dots = mountCard(axisAsset()).findAll('.tl-axis__dot').map(d => left(d.element))
    const gap1 = dots[1] - dots[0]   // 1385 → 1569: 184 роки
    const gap2 = dots[2] - dots[1]   // 1569 → 1772: 203 роки
    const gap4 = dots[4] - dots[3]   // 1794 → 1795: 1 рік
    expect(gap2 / gap1).toBeCloseTo(203 / 184, 2)
    expect(gap4).toBeLessThan(gap1 / 50)
  })

  it('смужка етапів суцільна: етап — до початку наступного', () => {
    const [a, b] = mountCard(axisAsset()).findAll('.tl-axis__era').map(e => e.element as HTMLElement)
    expect(parseFloat(a.style.left) + parseFloat(a.style.width)).toBeCloseTo(parseFloat(b.style.left), 5)
  })
})

describe('один штатний запис', () => {
  it('фішка іншої події — рівно один update:asset з active_event_id', async () => {
    const w = mountCard(axisAsset())
    await w.findAll('.tl-axis__chip')[2].trigger('click')
    const updates = w.emitted('update:asset')!
    expect(updates).toHaveLength(1)
    expect((updates[0][0] as WBAsset).data).toMatchObject({ active_event_id: 'event-3' })
  })

  it('натиск на вже відкриту подію нічого не пише (без перемикання в «жодної»)', async () => {
    const w = mountCard(axisAsset())
    await w.findAll('.tl-axis__dot')[0].trigger('click')
    expect(w.emitted('update:asset')).toBeUndefined()
  })

  it('«Наступна» і етап — той самий запис', async () => {
    const w = mountCard(axisAsset())
    await w.find('[data-testid="timeline-axis-next"]').trigger('click')
    await w.find('[data-testid="timeline-axis-era-1"]').trigger('click')
    const ids = w.emitted('update:asset')!.map(u => ((u[0] as WBAsset).data as { active_event_id: string }).active_event_id)
    expect(ids).toEqual(['event-2', 'event-3'])
  })

  it('учень (без interactive) — без перемикачів і без записів', async () => {
    const w = mountCard(axisAsset(), false)
    expect(w.find('[data-testid="timeline-axis-quiz"]').exists()).toBe(false)
    await w.findAll('.tl-axis__chip')[2].trigger('click')
    expect(w.emitted('update:asset')).toBeUndefined()
  })

  it('«▶» — те саме «Наступна» раз на 4,5 с', async () => {
    vi.useFakeTimers()
    const w = mountCard(axisAsset())
    await w.find('[data-testid="timeline-axis-play"]').trigger('click')
    vi.advanceTimersByTime(4500)
    const updates = w.emitted('update:asset')!
    expect(updates).toHaveLength(1)
    expect((updates[0][0] as WBAsset).data).toMatchObject({ active_event_id: 'event-2' })
    w.unmount()   // «грає» — спільний стан екрана (LAW §9 v1.75): не лишати його іншим тестам
  })
})

describe('«Перевір себе» — лише цей екран', () => {
  it('дати сховані до відповіді, правильна — серед чотирьох варіантів; записів немає', async () => {
    const w = mountCard(axisAsset({ active_event_id: 'event-3' }))
    await w.find('[data-testid="timeline-axis-quiz"]').trigger('click')
    expect(w.findAll('.tl-axis__chip b').map(b => b.text())).toEqual(['????', '????', '????', '????', '????'])
    expect(w.find('[data-testid="timeline-axis-big"]').exists()).toBe(false)
    expect(w.find('.tl-axis__text').exists()).toBe(false)
    const opts = w.findAll('.tl-axis__opt').map(o => o.text())
    expect(opts).toHaveLength(4)
    expect(opts).toContain('1772')

    await w.find('[data-testid="timeline-axis-opt-1772"]').trigger('click')
    expect(w.find('.tl-axis__qmsg').text()).toBe('Правильно!')
    expect(w.find('[data-testid="timeline-axis-big"]').text()).toBe('1772')
    expect(w.find('[data-testid="timeline-axis-score"]').text()).toBe('1 з 1')
    expect(w.emitted('update:asset')).toBeUndefined()
  })

  it('хибна відповідь — показує правильну, рахунок не росте', async () => {
    const w = mountCard(axisAsset({ active_event_id: 'event-3' }))
    await w.find('[data-testid="timeline-axis-quiz"]').trigger('click')
    const wrong = w.findAll('.tl-axis__opt').find(o => o.text() !== '1772')!
    await wrong.trigger('click')
    expect(w.find('.tl-axis__qmsg').text()).toBe('Правильна відповідь: 1772')
    expect(w.find('[data-testid="timeline-axis-score"]').text()).toBe('0 з 1')
  })
})

describe('перевірка не підказує відповіді', () => {
  it('рік у назві події схований до відповіді — і на фішці, і в заголовку', async () => {
    const asset = axisAsset({ active_event_id: 'event-3' })
    const events = (asset.data as { events: Array<{ label: string }> }).events
    events[2].label = 'Перший поділ (1772)'
    events[0].label = 'Кревська унія 1385—1386'
    const w = mountCard(asset)
    await w.find('[data-testid="timeline-axis-quiz"]').trigger('click')
    expect(w.find('.tl-axis__title').text()).toBe('Перший поділ (…)')
    expect(w.findAll('.tl-axis__chip span')[0].text()).toBe('Кревська унія …')
    await w.find('[data-testid="timeline-axis-opt-1772"]').trigger('click')
    expect(w.find('.tl-axis__title').text()).toBe('Перший поділ (1772)')
  })

  it('етап з однією подією — один рік, а не «1841–1841»', () => {
    const w = mountCard(axisAsset({ eras: [{ name: 'Причини', from: 1385, to: 1385 }, { name: 'Поділи', from: 1569, to: 1795 }] }))
    expect(w.find('.tl-axis__row b').text()).toBe('1385')
  })
})

describe('«на всю дошку» (власник 2026-10-29: «щоб діти могли це бачити»)', () => {
  it('розгорнута картка позначена й не просить висоти (вигляд одного екрана не записується)', async () => {
    const w = mount(TimelineCardRenderer, {
      props: { asset: axisAsset(), isSelected: false, interactive: true, isExpanded: true },
      global: { plugins: [i18n()] },
    })
    expect(w.find('.timeline-card').classes()).toContain('is-expanded')
    await w.vm.$nextTick()
    expect(w.emitted('request-height')).toBeUndefined()
  })

  it('шкалу можна розгорнути: ⛶ дає спільна панель картки, реєстр передає isExpanded і expand', async () => {
    const { isFullscreenAsset } = await import('../board/objectStandard')
    const { OVERLAY_RENDERERS } = await import('../components/canvas/overlayRegistry')
    expect(isFullscreenAsset('timeline_card')).toBe(true)
    const entry = OVERLAY_RENDERERS.timeline_card
    expect(entry.expandable).toBe(true)
    const toggle = vi.fn()
    const ctx = { expandedId: 'tl1', toggleExpand: toggle, onUpdate: vi.fn(), onDelete: vi.fn(), onActivateLinked: vi.fn(),
      onSelectOther: vi.fn(), onRequestHeight: vi.fn(), isTutor: true, boardMode: 'edit', interactive: true,
      isSelected: () => false, selectedIds: new Set(), canFit: true } as never
    expect(entry.buildProps(axisAsset(), ctx)).toMatchObject({ isExpanded: true })
    ;(entry.buildEvents(axisAsset(), ctx) as Record<string, () => void>).expand()
    expect(toggle).toHaveBeenCalledWith('tl1')
  })
})

describe('текст події: «… далі» і мова статті (власник 2026-10-29: «на самому цікавому місці обрізалось»)', () => {
  const withText = () => {
    const asset = axisAsset()
    const events = (asset.data as { events: Array<Record<string, unknown>> }).events
    events[0].description = 'Початок статті. Друге речення. …'
    events[0].description_full = 'Початок статті. Друге речення. Третє.\n\nДругий абзац.'
    events[1].description_lang = 'en'
    return asset
  }

  it('спершу початок; натиск на «… далі» чи на сам текст — увесь вступ; записів немає', async () => {
    const w = mountCard(withText())
    expect(w.find('[data-testid="timeline-axis-text"]').text()).toBe('Початок статті. Друге речення. …')
    await w.find('[data-testid="timeline-axis-more"]').trigger('click')
    expect(w.find('[data-testid="timeline-axis-text"]').text()).toContain('Другий абзац.')
    await w.find('[data-testid="timeline-axis-text"]').trigger('click')
    expect(w.find('[data-testid="timeline-axis-text"]').text()).toBe('Початок статті. Друге речення. …')
    expect(w.emitted('update:asset')).toBeUndefined()
  })

  it('інша подія — знову початок; без повного вступу кнопки «далі» немає', async () => {
    const w = mountCard(withText())
    await w.find('[data-testid="timeline-axis-more"]').trigger('click')
    await w.setProps({ asset: { ...withText(), data: { ...(withText().data as object), active_event_id: 'event-2' } } })
    expect(w.find('[data-testid="timeline-axis-more"]').exists()).toBe(false)
    await w.setProps({ asset: withText() })
    expect(w.find('[data-testid="timeline-axis-text"]').text()).toBe('Початок статті. Друге речення. …')
  })

  it('статті мовою матеріалу немає — чесна позначка «Стаття лише англійською»', () => {
    const w = mountCard({ ...withText(), data: { ...(withText().data as object), active_event_id: 'event-2' } } as WBAsset)
    expect(w.find('[data-testid="timeline-axis-lang"]').text()).toBe('Стаття лише англійською')
    const first = mountCard(withText())
    expect(first.find('[data-testid="timeline-axis-lang"]').exists()).toBe(false)
  })
})
