/**
 * Помилки полів у формах реєстрації (вчитель і учень).
 *
 * Привід — FIRST USER GATE 2026-09-23 (`saas_docs/FIRST_USER_GATE_2026-09-23.md`,
 * п.7): під «Підтвердьте пароль» новий вчитель бачив англійське «mismatch»,
 * і воно не зникало, навіть коли паролі вже збігались.
 *
 * Звідки: бекенд для більшості полів віддає готовий текст
 * (`field_messages`), але для незбігу паролів — сирий код
 * `{'password_confirm': ['mismatch']}` (`serializers_v1_auth.py`). Форма
 * показувала його як є. А помилка з попереднього надсилання лежала в
 * `auth.lastFieldMessages` доти, доки не прийде наступна відповідь сервера.
 *
 * Тут три речі:
 *   1. сирі коди перекладаємо (`mismatch` → «Паролі не збігаються»);
 *   2. незбіг паролів ловимо ще до надсилання — без походу на сервер;
 *   3. помилку поля прибираємо, щойно людина це поле змінила.
 */
import { ref, watch } from 'vue'

type FieldMessages = Record<string, unknown> | null | undefined

interface AuthLike {
  lastFieldMessages: FieldMessages
}

/** Коди, які бекенд може прислати замість тексту, → ключі перекладу. */
const RAW_CODE_KEYS: Record<string, string> = {
  mismatch: 'auth.register.passwordMismatch',
}

export function useRegisterFieldErrors(
  auth: AuthLike,
  form: Record<string, unknown>,
  t: (key: string) => string,
) {
  /** Помилки, які форма знайшла сама, до сервера. */
  const localErrors = ref<Record<string, string>>({})

  function serverMessage(field: string): string {
    const map = auth.lastFieldMessages
    if (!map || typeof map !== 'object') return ''
    const list = (map as Record<string, unknown>)[field]
    if (!Array.isArray(list) || list.length === 0) return ''
    const raw = String(list[0])
    const key = RAW_CODE_KEYS[raw.trim()]
    return key ? t(key) : raw
  }

  function fieldError(field: string): string {
    return localErrors.value[field] || serverMessage(field)
  }

  /** Перевірка перед надсиланням. `false` — не надсилати. */
  function validateBeforeSubmit(): boolean {
    const next: Record<string, string> = {}
    if (String(form.password ?? '') !== String(form.password_confirm ?? '')) {
      next.password_confirm = t(RAW_CODE_KEYS.mismatch)
    }
    localErrors.value = next
    return Object.keys(next).length === 0
  }

  function clearField(field: string) {
    if (localErrors.value[field]) {
      const { [field]: _dropped, ...rest } = localErrors.value
      localErrors.value = rest
    }
    const map = auth.lastFieldMessages
    if (map && typeof map === 'object' && field in map) {
      const { [field]: _gone, ...rest } = map as Record<string, unknown>
      auth.lastFieldMessages = Object.keys(rest).length ? rest : null
    }
  }

  // Людина змінила поле → стара помилка цього поля більше не про нього.
  // Незбіг паролів стосується обох полів, тож зміна будь-якого з них
  // прибирає помилку під «Підтвердьте пароль».
  for (const field of Object.keys(form)) {
    watch(
      () => form[field],
      () => {
        clearField(field)
        if (field === 'password') clearField('password_confirm')
      },
    )
  }

  return { fieldError, validateBeforeSubmit, clearField }
}
