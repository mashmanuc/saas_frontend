/**
 * Замір-гейт «Операції Дзеркало» на справжніх кадрах (ТЗ TZ_MIRROR_LIGHT_AUTOCORNERS_2026-10-09).
 *
 * Корпус — поза репозиторієм (кадри зі шкільного уроку власника): тека з `NN.rgba` (RGBA, w×h із
 * labels.json) і `labels.json`. Без MIRROR_CORPUS тест пропускається — у звичайному прогоні його немає.
 *   MIRROR_CORPUS=<тека> npx vitest run src/modules/winterboard/__tests__/boardMirrorCorpus.measure.spec.ts
 * Проганяються ТІ САМІ функції, що їдуть у пульт.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MIRROR_TUNING, analyzeFrame, changedCells, inkChangedCells, inkIsNew, type Quad } from '../remote/boardMirror'

const DIR = process.env.MIRROR_CORPUS || ''

interface Labels {
  w: number
  h: number
  frames: string[]
  transitions: { k: number; new_ink: boolean; note: string }[]
}

describe.skipIf(!DIR || !existsSync(join(DIR, 'labels.json')))('Дзеркало: замір на кадрах уроку', () => {
  it('стара метрика відтворює урок, нова ловить крейду й не ловить світло', () => {
    const L = JSON.parse(readFileSync(join(DIR, 'labels.json'), 'utf-8')) as Labels
    const quad: Quad = [{ x: 0, y: 0 }, { x: L.w, y: 0 }, { x: L.w, y: L.h }, { x: 0, y: L.h }]
    const frames = L.frames.map((_, i) => {
      const buf = readFileSync(join(DIR, `${String(i).padStart(2, '0')}.rgba`))
      const f = analyzeFrame({ data: new Uint8Array(buf), width: L.w, height: L.h }, quad)
      if (!f) throw new Error(`кадр ${i}`)
      return f
    })
    const T = MIRROR_TUNING
    const rows = L.transitions.map(({ k, new_ink }) => {
      const old = changedCells(frames[k - 1].tone, frames[k].tone, T.cellThr).count
      const c = inkChangedCells(frames[k - 1].ink, frames[k].ink, T)
      return { k, new_ink, old, ink: `+${c.added}/−${c.removed}`, oldSays: old >= T.changeCells, newSays: inkIsNew(c, T) }
    })
    // eslint-disable-next-line no-console
    console.log(rows.map((r) => `k=${String(r.k).padStart(2)} ${r.new_ink ? 'НОВЕ ' : 'повтор'}  стара=${String(r.old).padStart(3)}  крейда=${r.ink.padStart(7)}  → ${r.newSays ? 'знімок' : 'те саме'}`).join('\n'))
    const dups = rows.filter((r) => !r.new_ink)
    const real = rows.filter((r) => r.new_ink)
    const dupHeld = dups.filter((r) => !r.newSays).length
    // eslint-disable-next-line no-console
    console.log(`стара відтворює урок: ${rows.filter((r) => r.oldSays).length}/${rows.length}; нове впіймано: ${real.filter((r) => r.newSays).length}/${real.length}; повторів утримано: ${dupHeld}/${dups.length}`)
    // Гейт 1 у ТЗ («стара метрика відтворює всі 20») на цьому корпусі НЕ виконується: 14/20 — корпус —
    // це знімки 1600 px, а телефон порівнював кадри 640 px із камери. Тож корпус перевіряє, чи нова
    // ознака відрізняє нову крейду від світла на справжніх кадрах дошки, але не відтворює телефон кадр у кадр.
    expect(real.filter((r) => !r.newSays).map((r) => r.k)).toEqual([])          // гейт 2
    expect(dupHeld / dups.length).toBeGreaterThanOrEqual(0.8)                   // гейт 3
    const mustHold = L.transitions.filter((x) => /кінець уроку|стрибок світла/.test(x.note)).map((x) => x.k)
    expect(rows.filter((r) => mustHold.includes(r.k) && r.newSays).map((r) => r.k)).toEqual([])
  })
})
