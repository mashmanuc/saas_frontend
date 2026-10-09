/**
 * Замір-гейт Б «Операції Дзеркало»: телефон сам знаходить кути дошки (ТЗ TZ_MIRROR_LIGHT_AUTOCORNERS_2026-10-09 §2).
 *
 * Корпус — поза репозиторієм (фото дошки власника): тека з `<name>.rgba` і `labels.json`
 * ([{name, w, h, kind: 'full'|'partial', quad?: [[x,y]×4] у частках кадру}]). Без DETECT_CORPUS — пропуск.
 *   DETECT_CORPUS=<тека> npx vitest run src/modules/winterboard/__tests__/boardMirrorDetect.measure.spec.ts
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectBoardQuad } from '../remote/boardMirror'

const DIR = process.env.DETECT_CORPUS || ''

interface Item { name: string; w: number; h: number; kind: 'full' | 'partial'; quad?: [number, number][]; note: string }

describe.skipIf(!DIR || !existsSync(join(DIR, 'labels.json')))('Дзеркало: пошук дошки на справжніх кадрах', () => {
  it('повна дошка — кути ≤ 4 % діагоналі; часткова — «не вся в кадрі» або «не знайшла»', () => {
    const items = JSON.parse(readFileSync(join(DIR, 'labels.json'), 'utf-8')) as Item[]
    const bad: string[] = []
    for (const it of items) {
      const found = detectBoardQuad({ data: new Uint8Array(readFileSync(join(DIR, `${it.name}.rgba`))), width: it.w, height: it.h })
      let line = `${it.name.padEnd(7)} ${it.kind.padEnd(7)} → `
      if (!found) line += 'не знайшла'
      else line += `${found.clipped ? 'не вся в кадрі' : 'знайшла'} ${found.quad.map((p) => `(${p.x.toFixed(3)},${p.y.toFixed(3)})`).join(' ')}`
      if (it.kind === 'full') {
        if (!found || found.clipped || !it.quad) bad.push(it.name)
        else {
          // відстань у пікселях кадру, поділена на діагональ дошки (за позначеними кутами)
          const q = it.quad.map(([x, y]) => ({ x: x * it.w, y: y * it.h }))
          const diag = Math.max(Math.hypot(q[0].x - q[2].x, q[0].y - q[2].y), Math.hypot(q[1].x - q[3].x, q[1].y - q[3].y))
          const errs = found.quad.map((p, i) => Math.hypot(p.x * it.w - q[i].x, p.y * it.h - q[i].y) / diag)
          line += ` | похибка кутів ${errs.map((e) => `${(e * 100).toFixed(1)}%`).join(' ')}`
          if (errs.some((e) => e > 0.04)) bad.push(it.name)
        }
      } else if (found && !found.clipped) bad.push(it.name)
      // eslint-disable-next-line no-console
      console.log(line)
    }
    expect(bad).toEqual([])
  })
})
