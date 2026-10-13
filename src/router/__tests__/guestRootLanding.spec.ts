/**
 * Корінь `/` для гостя веде на лендінг `/start`, а не на гостьову дошку `/workspace`
 * (власник 2026-10-13: «зробити перенаправлення зразу на лендінг, а не показувати цю дошку»).
 * Guard структурний: справжній beforeEach тягне весь застосунок, а правило — одна гілка.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const router = readFileSync(resolve(__dirname, '../index.js'), 'utf8')
const wbRouter = readFileSync(resolve(__dirname, '../../modules/winterboard/router.ts'), 'utf8')

describe('гість на m4sh.org', () => {
  it('корінь → /start', () => {
    expect(router).toMatch(/if \(to\.path === '\/'\) \{\s*return next\('\/start'\)\s*\}/)
  })

  it('корінь більше не веде гостя на /workspace', () => {
    expect(router).not.toContain("return next('/workspace')")
  })

  it('сам /workspace лишається маршрутом (збережена робота гостей не губиться)', () => {
    expect(wbRouter).toMatch(/path: '\/workspace',\s*name: 'local-workspace'/)
  })
})
