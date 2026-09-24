/**
 * ✨ / 🔎 — лише там, де є що збагачувати (власник 2026-09-24).
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Кнопки показувались на БУДЬ-ЯКІЙ дошці конструктора, а працюють лише зі
 * згенерованим уроком: модалка питає артефакт і на порожній дошці відповідає
 * «уроку для збагачення ще немає». Кнопка є, клікається — і веде в глухий кут.
 *
 * ІНВАРІАНТИ
 *   INV-ENRICH-1  умова показу — наявність артефакту, а не сам конструктор
 *   INV-ENRICH-2  артефакт питаємо в шапці, до показу кнопок
 *   INV-ENRICH-3  немає відповіді / помилка / не конструктор → кнопок немає
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/modules/winterboard/views/WBSoloRoom.vue', 'utf8')

describe('гейт кнопок ✨ / 🔎', () => {
  it('INV-ENRICH-1: обидві кнопки висять на одній умові з артефактом', () => {
    const uses = SRC.match(/v-if="hasEnrichableLesson"/g) ?? []
    expect(uses.length).toBe(2)
    // стара умова «просто конструктор» більше не керує цими кнопками
    expect(SRC).not.toMatch(/v-if="constructorMode && sessionId && isSessionOwner"[\s\S]{0,200}aiEnrich/)
    expect(SRC).not.toMatch(/v-if="constructorMode && sessionId && isSessionOwner"[\s\S]{0,200}reviewButton/)
  })

  it('INV-ENRICH-2: артефакт резолвиться в шапці', () => {
    expect(SRC).toMatch(/shipApi\.getSessionArtifact\(sid\)/)
    expect(SRC).toMatch(/hasLessonArtifact\.value = !!art\?\.id/)
  })

  it('INV-ENRICH-3: fail-closed — стан за замовчуванням і на помилці порожній', () => {
    expect(SRC).toMatch(/const hasLessonArtifact = ref\(false\)/)
    expect(SRC).toMatch(/catch \{[\s\S]{0,180}hasLessonArtifact\.value = false/)
    expect(SRC).toMatch(/if \(!isConstructor \|\| !sid \|\| !isOwner\) \{ hasLessonArtifact\.value = false; return \}/)
  })
})
