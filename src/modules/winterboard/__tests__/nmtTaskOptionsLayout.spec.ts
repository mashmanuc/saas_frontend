/** Сторож адаптивної сітки; справжні ширини додатково перевірені в браузері. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('варіанти задач на вузькому Replay', () => {
  it('мінімальна ширина колонки не більша за саму картку; колонки складаються автоматично', () => {
    const source = readFileSync('src/modules/winterboard/components/board/objects/NmtTaskRenderer.vue', 'utf8')
    const rule = source.match(/\.nmt-task__options\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(rule).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*220px\),\s*1fr\)\)/)
    expect(rule).not.toMatch(/overflow(?:-x)?:\s*hidden/)
  })
})
