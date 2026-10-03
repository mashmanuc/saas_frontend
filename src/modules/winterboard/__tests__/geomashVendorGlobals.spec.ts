/**
 * Б-143 (прод 2026-10-03): GeoMASH — біла картка без інструментів у всіх з 29.09.
 * Після Б-84 рушій іде окремим лінивим чанком, і прод-збірка загортає UMD-файли рушія як
 * CommonJS: усередині обгортки `module` є, тож рушій писав себе лише в module.exports, а
 * GeomashRenderer.mount() шукає його у window. Тест виконує файли рушія так, як прод-збірка
 * (з `module`), і так, як dev-сервер (без нього), — у window рушій мусить бути в обох.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

type Win = Record<string, any>
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '../vendor/geomash', file), 'utf-8')

/** Як у прод-збірці: обгортка CommonJS дає файлу власні `module` і `exports`. */
function runAsCommonJs(file: string, win: Win): { exports: any } {
  const module = { exports: {} as any }
  new Function('module', 'exports', 'window', read(file))(module, module.exports, win)
  return module
}

/** Як на dev-сервері: ES-модуль, `module` немає. */
function runAsEsm(file: string, win: Win): void {
  new Function('module', 'window', read(file))(undefined, win)
}

describe('рушій GeoMASH реєструє себе у window — картка шукає його там', () => {
  it('у прод-збірці (обгортка CommonJS)', () => {
    const win: Win = {}
    const engine = runAsCommonJs('geo-engine.js', win)
    const renderer = runAsCommonJs('geo-renderer.js', win)
    expect(typeof win.GeoEngine?.toolSpec).toBe('function')
    expect(win.GeoEngine.toolSpec().length).toBeGreaterThan(0)
    expect(typeof win.createGeoRenderer).toBe('function')
    // module.exports лишається для тих, хто бере рушій як CommonJS
    expect(engine.exports).toBe(win.GeoEngine)
    expect(renderer.exports.createGeoRenderer).toBe(win.createGeoRenderer)
  })

  it('на dev-сервері (ES-модуль без module)', () => {
    const win: Win = {}
    runAsEsm('geo-engine.js', win)
    runAsEsm('geo-renderer.js', win)
    expect(typeof win.GeoEngine?.toolSpec).toBe('function')
    expect(typeof win.createGeoRenderer).toBe('function')
  })
})
