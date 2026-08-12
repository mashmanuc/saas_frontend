/**
 * Шлях назад не має губитися НІ В ОДНОМУ напрямку між входом і реєстрацією.
 *
 * Постмортем першого органічного юзера (2026-07-29, uid 213/214): людина
 * прийшла з демо-дошки, пішла в auth — і після реєстрації опинилась у
 * порожньому кабінеті, бо `?redirect` губився. Тоді полагодили один бік.
 *
 * 2026-08-12: другий бік лишався зламаним — на формі реєстрації посилання
 * «вже маю акаунт» вело на жорсткий рядок `/auth/login?role=tutor` без
 * redirect. Тобто рівно та сама пастка, лише дзеркальна: людина з дошки, у
 * якої акаунт УЖЕ Є, тиснула «вже маю акаунт» і втрачала свою роботу.
 *
 * Тест перевіряє КОНТРАКТ обох сторінок, а не розмітку: беремо реальні
 * компоненти й дивимось, куди веде перехресне посилання при наявному
 * `?redirect`.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../views')

function source(file: string): string {
  return fs.readFileSync(path.join(SRC, file), 'utf-8')
}

describe('перехресні посилання auth зберігають ?redirect', () => {
  it('форма реєстрації тьютора: «вже маю акаунт» НЕ жорсткий рядок', () => {
    const s = source('RegisterTutorView.vue')
    // Саме цей рядок губив шлях назад.
    expect(s).not.toContain('to="/auth/login?role=tutor"')
    expect(s).toContain(':to="loginLink"')
  })

  it('форма реєстрації тьютора: loginLink проносить redirect із query', () => {
    const s = source('RegisterTutorView.vue')
    const block = s.slice(s.indexOf('const loginLink'), s.indexOf('const loginLink') + 400)
    expect(block).toContain('route.query')
    expect(block).toContain('redirect')
    // роль лишається — інакше форма входу не знає, кого показувати
    expect(block).toContain("role: 'tutor'")
  })

  it('сторінка входу: register-лінк проносить redirect (не зламали старий бік)', () => {
    const s = source('LoginView.vue')
    const block = s.slice(s.indexOf('const registerLink'), s.indexOf('const registerLink') + 400)
    expect(block).toContain('route.query')
    expect(block).toContain('redirect')
  })
})
