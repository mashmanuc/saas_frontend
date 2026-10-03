/**
 * Підтвердження після «← Мої уроки» з уроку за шаблоном (власник 2026-10-03):
 * «Урок збережено в «Проведених». Шаблон «…» не змінено.» + «Зберегти як новий шаблон».
 *
 * Правило — board/lessonExitNotice.ts; обв'язка в кімнаті (WBSoloRoom) — сторожем
 * по джерелу: кімнати в тестах не монтуються.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  SAVE_COPY_QUERY,
  SAVE_COPY_TITLE_QUERY,
  isLessonContentOp,
  saveCopyHref,
  shouldShowLessonExitNotice,
  type LessonExitNoticeInput,
} from '../board/lessonExitNotice'

const base: LessonExitNoticeInput = {
  canSaveAsNewTemplate: true,
  toLessons: true,
  contentChanged: true,
  allOnServer: true,
}
const show = (patch: Partial<LessonExitNoticeInput>) => shouldShowLessonExitNotice({ ...base, ...patch })

describe('правило підтвердження після «← Мої уроки»', () => {
  it('показуємо: урок із шаблону, урок змінювали, усе на сервері', () => {
    expect(show({})).toBe(true)
  })
  it('урок не змінювали (або все вже збережено як новий шаблон) — тиша', () => {
    expect(show({ contentChanged: false })).toBe(false)
  })
  it('зміни не дійшли на сервер (лише копія на комп’ютері) — тиша: «збережено» було б неправдою', () => {
    expect(show({ allOnServer: false })).toBe(false)
  })
  it('не урок із шаблону або вихід не в «Мої уроки» — тиша', () => {
    expect(show({ canSaveAsNewTemplate: false })).toBe(false)
    expect(show({ toLessons: false })).toBe(false)
  })
})

describe('що вважаємо зміною уроку', () => {
  it('гортання сторінок (page_navigate, шле кожне гортання) — НЕ зміна', () => {
    expect(isLessonContentOp('page_navigate')).toBe(false)
  })
  it('малювання, нові й змінені об’єкти, сторінки — зміна', () => {
    for (const op of ['stroke_add', 'strokes_add_batch', 'asset_add', 'asset_update', 'asset_delete', 'page_add', 'clear_page']) {
      expect(isLessonContentOp(op), op).toBe(true)
    }
  })
})

describe('дія «Зберегти як новий шаблон» у підтвердженні', () => {
  it('веде в «Мої уроки» з цією сесією й назвою за замовчуванням', () => {
    const href = saveCopyHref('/knowledge/my-lessons', 'sid-1', 'VISION_1 — копія')
    const [p, q] = href.split('?')
    expect(p).toBe('/knowledge/my-lessons')
    const params = new URLSearchParams(q)
    expect(params.get(SAVE_COPY_QUERY)).toBe('sid-1')
    expect(params.get(SAVE_COPY_TITLE_QUERY)).toBe('VISION_1 — копія')
  })
  it('без назви — лише сесія', () => {
    const params = new URLSearchParams(saveCopyHref('/knowledge/my-lessons', 'sid-2', '').split('?')[1])
    expect(params.get(SAVE_COPY_QUERY)).toBe('sid-2')
    expect(params.has(SAVE_COPY_TITLE_QUERY)).toBe(false)
  })
})

describe('сторож обв’язки в WBSoloRoom', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8')
  const handleExit = src.slice(src.indexOf('async function handleExit()'), src.indexOf('function lessonExitNotice('))

  it('підтвердження лише після СПРАВЖНЬОГО переходу (скасований guard\'ом вихід — без нього)', () => {
    expect(handleExit).toMatch(/const failure = await router\.push\(target\.path\)/)
    expect(handleExit).toMatch(/if \(notice && !failure\) notice\(\)/)
  })
  it('рішення — до переходу, після дозбереження черги', () => {
    const save = handleExit.indexOf('await saveBeforeLeave()')
    const decide = handleExit.indexOf('lessonExitNotice(target.path)')
    const push = handleExit.indexOf('await router.push(target.path)')
    expect(save).toBeGreaterThan(-1)
    expect(save).toBeLessThan(decide)
    expect(decide).toBeLessThan(push)
  })
  it('зміни рахуються лише після bootstrap наявної дошки і лише операції вмісту', () => {
    expect(src).toMatch(/await opsSync\.bootstrap\(id\)[\s\S]{0,200}store\.onOperation\(\(op\) => \{\s*\n\s*if \(isLessonContentOp\(op\.op_type\)\) lessonContentChanged = true/)
  })
  it('після «Зберегти як новий шаблон» на дошці ці зміни вже не нагадуємо', () => {
    const saved = src.slice(src.indexOf('function handleCopySaved('), src.indexOf('async function openSaveTemplateDialog('))
    expect(saved).toMatch(/lessonContentChanged = false/)
  })
  it('підписку знімаємо разом із записувачем', () => {
    const cleanup = src.slice(src.indexOf('function cleanupRecorder()'), src.indexOf('replayRecorder.destroy()'))
    expect(cleanup).toMatch(/_unsubExitNoticeOps\?\.\(\)/)
  })
})
