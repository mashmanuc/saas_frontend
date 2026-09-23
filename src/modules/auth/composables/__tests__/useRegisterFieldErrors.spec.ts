/**
 * FIRST USER GATE 2026-09-23, п.7: під «Підтвердьте пароль» новий вчитель
 * бачив англійське «mismatch», і воно не зникало, навіть коли паролі вже
 * збігались. Бекенд для незбігу паролів шле сирий код, а не текст.
 */
import { describe, it, expect } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useRegisterFieldErrors } from '../useRegisterFieldErrors'

const t = (key: string) => (key === 'auth.register.passwordMismatch' ? 'Паролі не збігаються' : key)

function setup(serverMessages: Record<string, unknown> | null = null) {
  const auth = reactive({ lastFieldMessages: serverMessages as Record<string, unknown> | null })
  const form = reactive({ email: 'a@b.c', password: 'demo1234', password_confirm: 'demo1234' })
  const api = useRegisterFieldErrors(auth, form, t)
  return { auth, form, ...api }
}

describe('помилки полів реєстрації', () => {
  it('сирий код бекенда «mismatch» показується людською мовою', () => {
    const { fieldError } = setup({ password_confirm: ['mismatch'] })
    expect(fieldError('password_confirm')).toBe('Паролі не збігаються')
  })

  it('готовий текст бекенда лишається як є', () => {
    const { fieldError } = setup({ email: ['Ця пошта вже зареєстрована'] })
    expect(fieldError('email')).toBe('Ця пошта вже зареєстрована')
  })

  it('незбіг паролів ловиться ще до надсилання', () => {
    const { form, validateBeforeSubmit, fieldError } = setup()
    form.password_confirm = 'demo12345'
    expect(validateBeforeSubmit()).toBe(false)
    expect(fieldError('password_confirm')).toBe('Паролі не збігаються')
  })

  it('однакові паролі — надсилати можна', () => {
    const { validateBeforeSubmit, fieldError } = setup()
    expect(validateBeforeSubmit()).toBe(true)
    expect(fieldError('password_confirm')).toBe('')
  })

  it('помилка зникає, щойно людина змінила поле', async () => {
    const { form, auth, fieldError } = setup({ password_confirm: ['mismatch'] })
    form.password_confirm = 'demo1234x'
    await nextTick()
    expect(fieldError('password_confirm')).toBe('')
    expect(auth.lastFieldMessages).toBeNull()
  })

  it('зміна першого пароля теж прибирає помилку під підтвердженням', async () => {
    const { form, fieldError } = setup({ password_confirm: ['mismatch'] })
    form.password = 'другий'
    await nextTick()
    expect(fieldError('password_confirm')).toBe('')
  })
})
