/**
 * V-D3 · обов'язкові тести капсули `visual.triangles.congruence.overlay` v1.
 *
 * ТЗ: saas_docs/plans/two_apps/lesson_content/17_TZ_FEYA_VD3_TRIANGLE_OVERLAY_SPIKE_2026-09-14.md §7.
 * Нумерація describe-блоків = нумерація пунктів ТЗ. П.16 (наявні тести не отримали нових
 * падінь) — прогін зони winterboard, фіксується у звіті, а не тут.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import VisualCapsuleTrianglesOverlay from '../components/board/objects/VisualCapsuleTrianglesOverlay.vue'
import DevVisualCapsuleTrianglesOverlay from '../../dev/views/DevVisualCapsuleTrianglesOverlay.vue'
import {
  primaryAction,
  resolveControls,
  runPrimaryAction,
} from '../components/board/objects/visualCapsules/capsuleControls'
import {
  OverlayPlayer,
  scriptedDurationMs,
  type FrameScheduler,
  type PlayerSnapshot,
} from '../components/board/objects/visualCapsules/overlayPlayer'
import {
  presetFor,
  resolveCapsule,
  UnknownVisualCapsuleError,
} from '../components/board/objects/visualCapsules/capsuleRegistry'
import {
  landingVertex,
  pose,
  sideLengths,
  TARGET,
} from '../components/board/objects/visualCapsules/trianglesOverlayGeometry'
import {
  advance,
  assertState,
  CORRESPONDENCE,
  createEnvelope,
  highlightLevel,
  marksFor,
  REVEAL_STEPS,
  SceneContractError,
  SIDE_PAIR,
  STATES,
  VERSION,
  VISUAL_ID,
  withPrediction,
  type SceneState,
} from '../components/board/objects/visualCapsules/trianglesOverlayMachine'
import { devOnlyRoutes, DEV_VISUAL_CAPSULE_TRIANGLES_PATH } from '../../dev/devRoutes'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
/** Код без коментарів: пояснення «жодного store.updateAsset» не є викликом. */
const codeOnly = (src: string) =>
  src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/\s.*$/gm, '')

/** Ручний годинник кадрів: жодного справжнього rAF у тестах. */
function manualScheduler() {
  let now = 0
  let seq = 0
  const pending = new Map<number, (t: number) => void>()
  const s: FrameScheduler & { advance(ms: number): void; run(ms: number, frame?: number): void; readonly pending: number } = {
    requestFrame(cb) {
      seq += 1
      pending.set(seq, cb)
      return seq
    },
    cancelFrame(id) {
      pending.delete(id)
    },
    now: () => now,
    advance(ms) {
      now += ms
      const due = [...pending.values()]
      pending.clear()
      for (const cb of due) cb(now)
    },
    run(ms, frame = 16) {
      for (let t = 0; t < ms; t += frame) s.advance(frame)
    },
    get pending() {
      return pending.size
    },
  }
  return s
}

function recordStates(snaps: PlayerSnapshot[]): SceneState[] {
  const out: SceneState[] = []
  for (const snap of snaps) if (out[out.length - 1] !== snap.envelope.state) out.push(snap.envelope.state)
  return out
}

function newPlayer(mode: 'full' | 'recall', reducedMotion = false) {
  const scheduler = manualScheduler()
  const snaps: PlayerSnapshot[] = []
  const player = new OverlayPlayer({ mode, reducedMotion, scheduler, onChange: (s) => snaps.push(s) })
  return { player, scheduler, snaps }
}

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

function mountCapsule(props: Record<string, unknown>) {
  return mount(VisualCapsuleTrianglesOverlay, {
    props: { visualId: VISUAL_ID, version: VERSION, ...props },
    global: { plugins: [i18n()], stubs: { Geometry2DRenderer: true } },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('1 · ідентичність капсули', () => {
  it('рівно visual.triangles.congruence.overlay, версія 1', () => {
    expect(VISUAL_ID).toBe('visual.triangles.congruence.overlay')
    expect(VERSION).toBe(1)
    const capsule = resolveCapsule('visual.triangles.congruence.overlay', 1)
    expect([capsule.visual_id, capsule.version, capsule.preset]).toEqual([VISUAL_ID, 1, 'triangles_overlay'])
    const env = createEnvelope('full')
    expect([env.visual_id, env.version]).toEqual([VISUAL_ID, 1])
  })

  it('обгортка віддає початковий конверт при монтуванні', () => {
    const w = mountCapsule({ scheduler: manualScheduler() })
    const first = w.emitted('envelope')?.[0]?.[0] as { visual_id: string; version: number; state: string }
    expect([first.visual_id, first.version, first.state]).toEqual([VISUAL_ID, 1, 'separated'])
    w.unmount()
  })
})

describe('2 · машина рівно з п’яти станів', () => {
  it('перелік станів і відмова на невідомий', () => {
    expect(STATES).toEqual(['separated', 'predicting', 'overlaying', 'matched', 'correspondence'])
    expect(() => assertState('teleported')).toThrow(/невідомий стан/)
    let env = createEnvelope('full')
    for (let i = 0; i < 4; i += 1) env = advance(env)
    expect(env.state).toBe('correspondence')
    expect(() => advance(env)).toThrow(/останньому стані/)
    expect(() => withPrediction(createEnvelope('full'), 'D')).toThrow(/лише в стані predicting/)
    expect(() => withPrediction(advance(createEnvelope('full')), 'F' as never)).toThrow(/D або E/)
  })
})

describe('3 · повний прохід у заданому порядку', () => {
  it('стани йдуть за таблицею; «Спочатку» посеред руху не лишає кадру', () => {
    const { player, scheduler, snaps } = newPlayer('full')
    player.play()
    scheduler.run(6000)
    expect(player.snapshot.status).toBe('awaiting_prediction')
    player.play()
    scheduler.run(30000)
    expect(player.snapshot.status).toBe('finished')
    expect(recordStates(snaps)).toEqual([...STATES])

    const second = newPlayer('full')
    second.player.step()
    second.player.step()
    second.player.play()
    second.scheduler.run(2000)
    expect(second.player.snapshot.envelope.state).toBe('overlaying')
    expect(second.scheduler.pending).toBe(1)
    second.player.restart()
    expect(second.scheduler.pending).toBe(0)
    expect(second.player.snapshot.envelope.state).toBe('separated')
    expect(second.player.snapshot.progress).toBe(0)
  })
})

describe('4 · recall — та сама капсула й геометрія', () => {
  it('ті самі стани, та сама поза, вкладається в 20–60 с', () => {
    const capsule = resolveCapsule(VISUAL_ID, VERSION)
    expect(capsule.modes).toEqual(['full', 'recall'])
    const full = newPlayer('full')
    const recall = newPlayer('recall')
    expect(recall.player.snapshot.envelope.visual_id).toBe(full.player.snapshot.envelope.visual_id)
    expect(capsule.geometry.pose).toBe(pose)

    const total = scriptedDurationMs('recall')
    expect(total).toBeGreaterThanOrEqual(20000)
    expect(total).toBeLessThanOrEqual(60000)

    // Формула — не доказ: міряємо, коли сценарій справді закінчився (кадр 16 мс, 5 сегментів).
    recall.player.play()
    let finishedAt = 0
    for (let t = 16; t <= 60000 && !finishedAt; t += 16) {
      recall.scheduler.advance(16)
      if (recall.player.snapshot.status === 'finished') finishedAt = t
    }
    expect(finishedAt).toBeGreaterThanOrEqual(total)
    expect(finishedAt).toBeLessThanOrEqual(total + 5 * 16)
    expect(recall.player.snapshot.status).toBe('finished')
    expect(recordStates(recall.snaps)).toEqual([...STATES])
    expect(recall.player.snapshot.pose).toEqual(pose(1))
  })
})

describe('5 · прогноз E зберігається й спростовується', () => {
  it('prediction=E у конверті, після руху B → D', () => {
    const { player } = newPlayer('full')
    player.step() // → predicting
    player.setPrediction('E')
    expect(player.snapshot.envelope.prediction).toBe('E')
    player.step() // → overlaying
    player.step() // → matched
    const { marks, prediction } = player.snapshot.envelope
    expect(prediction).toBe('E')
    expect(marks).toMatchObject({ b_lands_on: 'D', prediction_refuted: true, prediction_confirmed: false })
  })
})

describe('6 · фінальна відповідність', () => {
  it('рівно A↔E, B↔D, C↔F, BC↔DF = 7 — обчислено з координат', () => {
    const computed = (['A', 'B', 'C'] as const).map((v) => [v, landingVertex(v)])
    expect(computed).toEqual([['A', 'E'], ['B', 'D'], ['C', 'F']])
    // Таблиця сцени мусить збігатися з геометрією: підміна B → E у ній тут червоніє.
    expect(CORRESPONDENCE.map(([s, t]) => [s, t])).toEqual(computed)
    expect(SIDE_PAIR).toEqual({ source: 'BC', target: 'DF', length_cm: 7 })
    const df = Math.hypot(TARGET.D.x - TARGET.F.x, TARGET.D.y - TARGET.F.y)
    expect(df).toBeCloseTo(7, 9)
    expect(marksFor('correspondence', 'E', 4)).toMatchObject({
      pairs: computed,
      side: { source: 'BC', target: 'DF', length_cm: 7 },
      revealed: 4,
    })
  })
})

describe('7 · інваріантність форми', () => {
  const expectShape = (p: ReturnType<typeof pose>) => {
    const l = sideLengths(p)
    expect(l.AB).toBeCloseTo(5, 9)
    expect(l.BC).toBeCloseTo(7, 9)
    expect(l.CA).toBeCloseTo(6, 9)
  }

  it('на початку, у проміжних частках і в кінці', () => {
    for (const s of [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1]) expectShape(pose(s))
  })

  it('у кожному кадрі реального прогону', () => {
    const { player, scheduler, snaps } = newPlayer('recall')
    player.play()
    scheduler.run(30000, 7)
    const moving = snaps.filter((s) => s.envelope.state === 'overlaying' && s.progress > 0 && s.progress < 1)
    expect(moving.length).toBeGreaterThan(20)
    for (const snap of moving) expectShape(snap.pose)
  })
})

describe('8 · пауза, продовження, спочатку', () => {
  it('pause зупиняє кадри; continue продовжує; restart → separated', () => {
    const { player, scheduler } = newPlayer('recall')
    player.step()
    player.step() // overlaying, progress 0
    player.play()
    scheduler.run(1000)
    const p1 = player.snapshot.progress
    expect(p1).toBeGreaterThan(0)
    player.pause()
    expect(scheduler.pending).toBe(0)
    scheduler.advance(5000)
    expect(player.snapshot.progress).toBe(p1)
    player.play()
    scheduler.run(500)
    expect(player.snapshot.progress).toBeGreaterThan(p1)
    player.restart()
    expect(player.snapshot.envelope.state).toBe('separated')
    expect(scheduler.pending).toBe(0)
  })
})

describe('9 · подвійний play не створює двох анімацій', () => {
  it('рівно один запланований кадр', () => {
    const { player, scheduler } = newPlayer('recall')
    const spy = vi.spyOn(scheduler, 'requestFrame')
    player.play()
    player.play()
    player.play()
    expect(scheduler.pending).toBe(1)
    scheduler.advance(16)
    expect(scheduler.pending).toBe(1)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('10 · prefers-reduced-motion', () => {
  it('ті самі семантичні стани й висновок, рух — одним кроком', () => {
    const calm = newPlayer('recall', true)
    calm.player.play()
    calm.scheduler.run(60000)
    const normal = newPlayer('recall', false)
    normal.player.play()
    normal.scheduler.run(60000)
    expect(recordStates(calm.snaps)).toEqual([...STATES])
    const inBetween = calm.snaps.filter((s) => s.progress > 0 && s.progress < 1)
    expect(inBetween).toHaveLength(0)
    expect(calm.player.snapshot.envelope.marks).toEqual(normal.player.snapshot.envelope.marks)
    expect(calm.player.snapshot.pose).toEqual(normal.player.snapshot.pose)
  })

  it('обгортка бере prefers-reduced-motion із matchMedia', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler })
    w.unmount()
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })
})

describe('11 · розмонтування скасовує кадр', () => {
  it('після unmount запланованих кадрів немає', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler, reducedMotion: false })
    await w.get('[data-testid="vcap-predict-E"]').trigger('click')
    await w.get('[data-testid="vcap-primary"]').trigger('click') // «Перевірити накладанням»
    expect(scheduler.pending).toBe(1)
    w.unmount()
    expect(scheduler.pending).toBe(0)
  })

  it('знищений програвач не оживає', () => {
    const { player } = newPlayer('full')
    player.destroy()
    expect(() => player.play()).toThrow(/знищено/)
  })
})

describe('12 · невідомий visual_id — явна помилка', () => {
  it('реєстр кидає, обгортка показує alert, а не порожній блок', () => {
    expect(() => resolveCapsule('visual.triangles.congruence.rotate', 1)).toThrow(UnknownVisualCapsuleError)
    expect(() => resolveCapsule(VISUAL_ID, 2)).toThrow(UnknownVisualCapsuleError)
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const w = mountCapsule({ visualId: 'visual.triangles.congruence.rotate' })
    const alert = w.get('[data-testid="visual-capsule-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('visual.triangles.congruence.rotate')
    expect(w.find('geometry2-d-renderer-stub').exists()).toBe(false)
    expect(w.find('[data-testid="vcap-primary"]').exists()).toBe(false)
    expect(w.find('[data-testid="vcap-predict-D"]').exists()).toBe(false)
    expect(w.find('[data-testid="vcap-play"]').exists()).toBe(false)
    expect(err).toHaveBeenCalled()
    w.unmount()
  })
})

describe('13 · схема асета не змінена', () => {
  it('geometry2dV2.ts байт-у-байт як на базі 4d400d3b; data.version = 1', () => {
    const types = read('modules/winterboard/types/geometry2dV2.ts')
    expect(createHash('sha256').update(types).digest('hex')).toBe(
      '10638170aeb7bf9d726b082313e4d85083d56bd8ab96573c11e8316296346ce7',
    )
    const w = mountCapsule({ scheduler: manualScheduler() })
    const asset = w.findComponent({ name: 'Geometry2DRenderer' }).props('asset') as {
      data: Record<string, unknown>
    }
    expect(asset.data.version).toBe(1)
    expect(Object.keys(asset.data).sort()).toEqual(['pointsSnapshot', 'preset', 'version'])
    w.unmount()
  })
})

describe('14 · жодних board ops, REST/WS чи мутації стору дошки', () => {
  const FILES = [
    'modules/winterboard/components/board/objects/VisualCapsuleTrianglesOverlay.vue',
    'modules/winterboard/components/board/objects/visualCapsules/overlayPlayer.ts',
    'modules/winterboard/components/board/objects/visualCapsules/trianglesOverlayMachine.ts',
    'modules/winterboard/components/board/objects/visualCapsules/trianglesOverlayGeometry.ts',
    'modules/winterboard/components/board/objects/visualCapsules/capsuleRegistry.ts',
    'modules/winterboard/components/board/objects/visualCapsules/capsuleControls.ts',
    'modules/dev/views/DevVisualCapsuleTrianglesOverlay.vue',
    'modules/dev/devRoutes.ts',
  ]
  const FORBIDDEN = [
    /useBoardStore|boardStore/, /updateAsset|addAsset/, /opsSync|\.record\(|\.flush\(/,
    /apiClient|axios|fetch\(/, /WebSocket|realtime|sendBeacon/, /scene_state_set|scene_control/,
    /REMOTE_CMDS|remote\.command/,
  ]

  it.each(FILES)('%s не згадує писарів дошки', (file) => {
    const src = codeOnly(read(file))
    for (const re of FORBIDDEN) expect(src, `${file} ~ ${re}`).not.toMatch(re)
  })

  it('прохід сцени не робить мережевих викликів', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler, mode: 'recall' })
    await w.get('[data-testid="vcap-predict-D"]').trigger('click')
    await w.get('[data-testid="vcap-primary"]').trigger('click')
    scheduler.run(60000)
    await nextTick()
    expect(w.get('[data-testid="visual-capsule"]').attributes('data-status')).toBe('finished')
    expect(fetchSpy).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('15 · DEV-маршрут відсутній у production-конфігурації', () => {
  it('devOnlyRoutes(false) — порожньо; роутер підключає лише через import.meta.env.DEV', () => {
    expect(devOnlyRoutes(false)).toEqual([])
    const dev = devOnlyRoutes(true)
    expect(dev.map((r) => r.path)).toEqual([DEV_VISUAL_CAPSULE_TRIANGLES_PATH])
    expect(DEV_VISUAL_CAPSULE_TRIANGLES_PATH).toBe('/dev/visual-capsules/triangles-overlay')
    const router = read('router/index.js')
    expect(router).toContain('...devOnlyRoutes(import.meta.env.DEV)')
    expect(router).not.toContain('visual-capsules')
  })
})

type PresetObject = Record<string, unknown> & { id: string }

async function buildPreset(key: string): Promise<Record<string, PresetObject>> {
  await import('../vendor/geo2d')
  const W = window as unknown as { Geo2D: { PRESETS: Record<string, { build(con: unknown): void }> } }
  const preset = W.Geo2D.PRESETS[key]
  if (!preset) throw new Error(`пресета ${key} немає`)
  const objects: PresetObject[] = []
  preset.build({ add: (o: PresetObject) => objects.push(o) })
  return Object.fromEntries(objects.map((o) => [o.id, o]))
}

const LEVEL_KEYS = ['triangles_overlay', ...Array.from({ length: REVEAL_STEPS }, (_, i) => `triangles_overlay_pairs_${i + 1}`)]

describe('пресет triangles_overlay = геометрія капсули', () => {
  it.each(LEVEL_KEYS)('%s: координати звірені з TS; якорі сховані; у трей не внесено', async (key) => {
    const byId = await buildPreset(key)
    const capsule = resolveCapsule(VISUAL_ID, VERSION)
    for (const [id, p] of Object.entries(capsule.geometry.pointsSnapshot(0))) {
      expect(byId[id], id).toBeDefined()
      expect(byId[id].x as number).toBeCloseTo(p.x, 3)
      expect(byId[id].y as number).toBeCloseTo(p.y, 3)
      expect(byId[id].movable, id).toBe(false)
    }
    expect([byId.VIEW_SW.hidden, byId.VIEW_NE.hidden]).toEqual([true, true])
    const tray = read('modules/winterboard/vendor/geo2d/geo2d-card.js')
    expect(tray).not.toContain('triangles_overlay')
  })
})

describe('6b · підсвітка відповідностей на рисунку', () => {
  it('рівень k підсвічує рівно перші k пунктів; цілі обчислено з координат, не з таблиці', async () => {
    for (let level = 0; level <= REVEAL_STEPS; level += 1) {
      const key = LEVEL_KEYS[level]
      const byId = await buildPreset(key)
      const highlighted = Object.values(byId).filter((o) => o.id.startsWith('hl_'))
      const rings = highlighted.filter((o) => o.kind === 'circle').map((o) => o.center)
      const expectedRings = CORRESPONDENCE.slice(0, level).map(([source]) => landingVertex(source))
      expect(rings, key).toEqual(expectedRings)
      const bands = highlighted.filter((o) => o.kind === 'segment').map((o) => `${o.a}${o.b}`)
      expect(bands, key).toEqual(level === REVEAL_STEPS ? [SIDE_PAIR.target] : [])
      expect(highlighted.length, key).toBe(expectedRings.length + bands.length)
    }
  })

  it('обгортка обирає рівень лише з конверта: до correspondence базовий, далі 1…4', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler, diagnostics: true })
    const preset = () =>
      (w.findComponent({ name: 'Geometry2DRenderer' }).props('asset') as { data: { preset: string } }).data.preset
    const seen: string[] = [preset()]
    for (let i = 0; i < 3 + REVEAL_STEPS; i += 1) {
      await w.get('[data-testid="vcap-step"]').trigger('click')
      seen.push(preset())
    }
    expect(seen).toEqual([
      'triangles_overlay', // separated
      'triangles_overlay', // predicting
      'triangles_overlay', // overlaying
      'triangles_overlay', // matched
      ...LEVEL_KEYS.slice(1),
    ])
    await w.get('[data-testid="vcap-restart"]').trigger('click')
    expect(preset()).toBe('triangles_overlay')
    w.unmount()
  })

  it('correspondence без коректного revealed — помилка контракту, а не «нуль підсвітки»', () => {
    const capsule = resolveCapsule(VISUAL_ID, VERSION)
    let env = createEnvelope('full')
    for (let i = 0; i < 3; i += 1) env = advance(env)
    expect(presetFor(capsule, env)).toBe('triangles_overlay')
    const corr = advance(env, 2)
    expect(highlightLevel(corr)).toBe(2)
    expect(presetFor(capsule, corr)).toBe('triangles_overlay_pairs_2')
    expect(() => highlightLevel({ ...corr, marks: { ...corr.marks, revealed: 0 } })).toThrow()
    expect(() => highlightLevel({ ...corr, marks: {} })).toThrow()
  })
})

// ── V-D3.1 · учительське керування ────────────────────────────────────────────────────
// Відгук власника: 19_V-D3_OWNER_REVIEW_2026-09-14.md, «Перевірки правки» 1–6.

const controlButtons = (w: VueWrapper) => w.findAll('[data-role="control"]')
const primaryOf = (w: VueWrapper) => w.find('[data-testid="vcap-primary"]')
const capsuleAttr = (w: VueWrapper, name: string) => w.get('[data-testid="visual-capsule"]').attributes(name)
/** Лабораторні інструменти, яких учитель не бачить за замовчуванням. */
const LAB_TOOLS = [
  'vcap-play', 'vcap-pause', 'vcap-step', 'vcap-restart',
  'vcap-status', 'vcap-envelope', 'vcap-diagnostics', 'vcap-mode-full', 'vcap-mode-recall',
]
const OWNER_POLICY = {
  prediction: 'visible',
  play_pause: 'visible',
  step: 'hidden',
  restart: 'shown_as_repeat_after_completion',
  mode_switch: 'outside_scene',
  diagnostics: 'dev_only',
}

async function teacherToFinish(w: VueWrapper, scheduler: ReturnType<typeof manualScheduler>, choice: 'D' | 'E') {
  await w.get(`[data-testid="vcap-predict-${choice}"]`).trigger('click')
  await w.get('[data-testid="vcap-primary"]').trigger('click')
  scheduler.run(60000)
  await nextTick()
}

describe('V-D3.1 · 1 · одна головна дія', () => {
  it('таблиця власника: до прогнозу — лише D/E; далі check → pause → resume → repeat', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler })
    const seen: Array<[string, string | null, number]> = []
    const look = async (label: string) => {
      await nextTick()
      expect(controlButtons(w).length, label).toBeLessThanOrEqual(1)
      seen.push([label, controlButtons(w)[0]?.attributes('data-action') ?? null, w.findAll('[data-role="prediction"]').length])
    }
    await look('до прогнозу')
    await w.get('[data-testid="vcap-predict-E"]').trigger('click')
    await look('прогноз обрано')
    await w.get('[data-testid="vcap-primary"]').trigger('click')
    scheduler.run(1000)
    await look('анімація йде')
    await w.get('[data-testid="vcap-primary"]').trigger('click')
    await look('на паузі')
    await w.get('[data-testid="vcap-primary"]').trigger('click')
    scheduler.run(60000)
    await look('завершено')
    expect(seen).toEqual([
      ['до прогнозу', null, 2],
      ['прогноз обрано', 'check', 2],
      ['анімація йде', 'pause', 0],
      ['на паузі', 'resume', 0],
      ['завершено', 'repeat', 0],
    ])
    w.unmount()
  })

  it('у кожному зрізі реального проходу full і recall — не більше однієї кнопки керування', async () => {
    for (const mode of ['full', 'recall'] as const) {
      const scheduler = manualScheduler()
      const w = mountCapsule({ scheduler, mode })
      await w.get('[data-testid="vcap-predict-D"]').trigger('click')
      await w.get('[data-testid="vcap-primary"]').trigger('click')
      let slices = 0
      while (capsuleAttr(w, 'data-status') !== 'finished' && slices < 400) {
        scheduler.run(250)
        await nextTick()
        expect(controlButtons(w).length, `${mode} @${slices}`).toBeLessThanOrEqual(1)
        slices += 1
      }
      expect(capsuleAttr(w, 'data-status'), mode).toBe('finished')
      expect(slices, mode).toBeGreaterThan(8)
      w.unmount()
    }
  })
})

describe('V-D3.1 · 2 · лабораторних інструментів за замовчуванням немає', () => {
  it('«Наступний крок», «Спочатку», SceneEnvelope і перемикач режиму відсутні на всіх етапах', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler })
    const absent = (label: string) => {
      for (const id of LAB_TOOLS) expect(w.find(`[data-testid="${id}"]`).exists(), `${label}: ${id}`).toBe(false)
      expect(w.text(), label).not.toMatch(/Наступний крок|Спочатку|SceneEnvelope|visual\.triangles/)
    }
    absent('старт')
    await w.get('[data-testid="vcap-predict-E"]').trigger('click')
    absent('прогноз')
    await w.get('[data-testid="vcap-primary"]').trigger('click')
    scheduler.run(2000)
    await nextTick()
    absent('рух')
    scheduler.run(60000)
    await nextTick()
    absent('кінець')
    w.unmount()
  })
})

describe('V-D3.1 · 3 · «Повторити» після завершення', () => {
  it('з’являється лише в кінці й повертає сцену до вибору прогнозу', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler })
    await teacherToFinish(w, scheduler, 'E')
    expect(primaryOf(w).attributes('data-action')).toBe('repeat')
    expect(primaryOf(w).text()).toBe('Повторити')
    await primaryOf(w).trigger('click')
    expect([capsuleAttr(w, 'data-state'), capsuleAttr(w, 'data-status')]).toEqual(['separated', 'idle'])
    expect(primaryOf(w).exists()).toBe(false)
    expect(w.findAll('[data-role="prediction"]')).toHaveLength(2)
    const emitted = w.emitted('envelope') ?? []
    const last = emitted[emitted.length - 1]?.[0] as { prediction: unknown; marks: unknown }
    expect([last.prediction, last.marks]).toEqual([null, {}])
    expect(scheduler.pending).toBe(0)
    w.unmount()
  })
})

describe('V-D3.1 · 4 · «Пауза» і «Продовжити» на одному місці', () => {
  it('той самий DOM-елемент міняє дію й підпис, а не дві кнопки поруч', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler })
    await w.get('[data-testid="vcap-predict-D"]').trigger('click')
    expect(primaryOf(w).text()).toBe('Перевірити накладанням')
    await primaryOf(w).trigger('click')
    const el = primaryOf(w).element
    expect([primaryOf(w).attributes('data-action'), primaryOf(w).text()]).toEqual(['pause', 'Пауза'])
    await primaryOf(w).trigger('click')
    expect(primaryOf(w).element).toBe(el)
    expect([primaryOf(w).attributes('data-action'), primaryOf(w).text()]).toEqual(['resume', 'Продовжити'])
    expect(scheduler.pending).toBe(0)
    await primaryOf(w).trigger('click')
    expect(primaryOf(w).element).toBe(el)
    expect([primaryOf(w).attributes('data-action'), primaryOf(w).text()]).toEqual(['pause', 'Пауза'])
    expect(scheduler.pending).toBe(1)
    expect(el.parentElement?.getAttribute('data-testid')).toBe('vcap-actions')
    expect(el.parentElement?.children).toHaveLength(1)
    w.unmount()
  })
})

describe('V-D3.1 · 5 · режим приходить від caller', () => {
  it('full і recall — та сама сцена; зміна пропа скидає сцену без паралельної анімації', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler, mode: 'recall' })
    expect(capsuleAttr(w, 'data-mode')).toBe('recall')
    await w.get('[data-testid="vcap-predict-D"]').trigger('click')
    await w.get('[data-testid="vcap-primary"]').trigger('click')
    scheduler.run(2500)
    expect(scheduler.pending).toBe(1)
    await w.setProps({ mode: 'full' })
    expect([capsuleAttr(w, 'data-mode'), capsuleAttr(w, 'data-state'), capsuleAttr(w, 'data-status')])
      .toEqual(['full', 'separated', 'idle'])
    expect(scheduler.pending).toBe(0)
    const ids = new Set((w.emitted('envelope') ?? []).map(([e]) => (e as { visual_id: string }).visual_id))
    expect([...ids]).toEqual([VISUAL_ID])
    const modes = new Set((w.emitted('envelope') ?? []).map(([e]) => (e as { mode: string }).mode))
    expect([...modes].sort()).toEqual(['full', 'recall'])
    const wrapperCode = codeOnly(read('modules/winterboard/components/board/objects/VisualCapsuleTrianglesOverlay.vue'))
    expect(wrapperCode).not.toMatch(/@click="player\.setMode/)
    w.unmount()
  })
})

describe('V-D3.1 · 6 · «Діагностика»', () => {
  it('явний режим повертає старі інструменти й SceneEnvelope; головна дія лишається одна', async () => {
    const scheduler = manualScheduler()
    const w = mountCapsule({ scheduler, diagnostics: true })
    for (const id of ['vcap-play', 'vcap-pause', 'vcap-step', 'vcap-restart', 'vcap-status', 'vcap-envelope']) {
      expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
    }
    expect(JSON.parse(w.get('[data-testid="vcap-envelope"]').text()).visual_id).toBe(VISUAL_ID)
    await w.get('[data-testid="vcap-step"]').trigger('click')
    expect(capsuleAttr(w, 'data-state')).toBe('predicting')
    expect(controlButtons(w).length).toBeLessThanOrEqual(1)
    w.unmount()
  })

  it('політика dev_only: запит діагностики поза DEV-збіркою ігнорується', () => {
    const { controls } = resolveCapsule(VISUAL_ID, VERSION)
    expect(resolveControls(controls, { diagnostics: true, isDev: false }).diagnostics).toBe(false)
    expect(resolveControls(controls, { diagnostics: false, isDev: true }).diagnostics).toBe(false)
    expect(resolveControls(controls, { diagnostics: true, isDev: true }).diagnostics).toBe(true)
    expect(resolveControls({ ...controls, diagnostics: 'hidden' }, { diagnostics: true, isDev: true }).diagnostics).toBe(false)
  })
})

describe('V-D3.1 · політика капсули задає видимий набір', () => {
  it('політика triangles_overlay дослівно з відгуку власника', () => {
    expect({ ...resolveCapsule(VISUAL_ID, VERSION).controls }).toEqual(OWNER_POLICY)
    const resolved = resolveControls(resolveCapsule(VISUAL_ID, VERSION).controls, { diagnostics: false, isDev: true })
    expect(resolved).toEqual({
      prediction: true,
      playPause: true,
      step: false,
      restart: false,
      repeatAfterCompletion: true,
      modeSwitchInScene: false,
      diagnostics: false,
    })
  })

  it('інша політика — інший набір із того самого контролера', () => {
    const { player, scheduler } = newPlayer('recall')
    const quiet = resolveControls(
      { ...resolveCapsule(VISUAL_ID, VERSION).controls, play_pause: 'hidden', restart: 'hidden' },
      { diagnostics: false, isDev: true },
    )
    player.step()
    player.setPrediction('D')
    runPrimaryAction(player, 'check')
    expect(primaryAction(player.snapshot, quiet)).toBeNull()
    scheduler.run(60000)
    expect(player.snapshot.status).toBe('finished')
    expect(primaryAction(player.snapshot, quiet)).toBeNull()
  })

  it('«Перевірити» без прогнозу чи поза predicting — помилка контракту', () => {
    const { player } = newPlayer('full')
    expect(() => runPrimaryAction(player, 'check')).toThrow(SceneContractError)
    player.step()
    expect(() => runPrimaryAction(player, 'check')).toThrow(SceneContractError)
    expect(player.snapshot.envelope.state).toBe('predicting')
  })
})

describe('V-D3.1 · DEV-сторінка = майбутній учительський вигляд', () => {
  async function mountDev(url: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: DEV_VISUAL_CAPSULE_TRIANGLES_PATH, component: DevVisualCapsuleTrianglesOverlay }],
    })
    await router.push(url)
    await router.isReady()
    const w = mount(RouterView, { global: { plugins: [router, i18n()], stubs: { Geometry2DRenderer: true } } })
    await flushPromises()
    return { w, router }
  }

  it('за замовчуванням — учительський вигляд; параметри перегляду поза сценою', async () => {
    const { w } = await mountDev(DEV_VISUAL_CAPSULE_TRIANGLES_PATH)
    const capsule = w.get('[data-testid="visual-capsule"]')
    expect(capsule.attributes('data-mode')).toBe('full')
    for (const id of LAB_TOOLS) expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
    expect(w.find('[data-testid="dev-envelope"]').exists()).toBe(false)
    expect(w.find('[data-testid="dev-preview-params"]').exists()).toBe(true)
    expect(capsule.find('[data-testid="dev-preview-params"]').exists()).toBe(false)
    w.unmount()
  })

  it('?mode=recall&diagnostics=1 — recall і діагностика; перемикач пише в адресу', async () => {
    const { w, router } = await mountDev(`${DEV_VISUAL_CAPSULE_TRIANGLES_PATH}?mode=recall&diagnostics=1`)
    expect(w.get('[data-testid="visual-capsule"]').attributes('data-mode')).toBe('recall')
    expect(w.find('[data-testid="vcap-diagnostics"]').exists()).toBe(true)
    await w.get('[data-testid="dev-mode-full"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.mode).toBe('full')
    expect(w.get('[data-testid="visual-capsule"]').attributes('data-mode')).toBe('full')
    await w.get('[data-testid="dev-diagnostics"]').setValue(false)
    await flushPromises()
    expect(router.currentRoute.value.query.diagnostics).toBeUndefined()
    expect(w.find('[data-testid="vcap-diagnostics"]').exists()).toBe(false)
    w.unmount()
  })
})
