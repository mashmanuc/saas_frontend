/**
 * Інтегралик мусить питати тип уроку — kill-тест на розмітку команди.
 *
 * Чому читаємо файл, а не монтуємо: команда `cmdGenerateLesson` — локальна
 * константа всередині `<script setup>`, назовні її не видно, а монтувати всю
 * палітру заради одного масиву параметрів дорожче, ніж воно того варте.
 *
 * Що саме стережемо: 2026-09-08 виявилось, що цей шлях створення уроку типу не
 * передавав ЗОВСІМ, і сервер мовчки робив «нову тему» — навіть коли вчитель
 * просив контрольну. Тепер бекенд без типу відмовляє (`LESSON_TYPE_REQUIRED`),
 * тож якщо цей крок приберуть, команда просто перестане працювати. Тест ловить
 * це в нас, а не в учителя.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../CommandPalette.vue'), 'utf8')

describe('команда «Згенерувати урок»', () => {
  it('питає тип уроку', () => {
    expect(SRC).toContain("key: 'lesson_type'")
    expect(SRC).toMatch(/lesson_type[\s\S]{0,120}required: true/)
  })

  it('тип іде першим питанням — раніше за тему', () => {
    const typeAt = SRC.indexOf("key: 'lesson_type'")
    const topicAt = SRC.indexOf("key: 'topics'")
    expect(typeAt).toBeGreaterThan(-1)
    expect(typeAt).toBeLessThan(topicAt)
  })

  it('обраний тип долітає до бекенда', () => {
    expect(SRC).toContain('lesson_type: v.lesson_type')
  })

  it('список типів — спільний з Конструктором, не другий словник', () => {
    expect(SRC).toContain("from '@/modules/lesson_constructor/lessonTypeRules'")
    expect(SRC).toContain('LESSON_TYPE_OPTIONS.map')
  })
})
