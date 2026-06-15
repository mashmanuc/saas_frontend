/**
 * Composable for accepting tutor invites — unified flow (A3).
 *
 * - accept()                 → existing authenticated student → bond.
 * - acceptWithRegistration() → anonymous new student: register-inline + bond + login.
 *
 * Маршрутизація відповідей BE (контракт INVITE_CONSOLIDATION_TECHNICAL_DESIGN §1.3):
 *   200                       → existing bond (success-стан на сторінці)
 *   201 + access              → новий учень залогінений → dashboard
 *   201 LOGIN_REQUIRED        → акаунт створено, JWT не видано → login
 *   409 INVITE_ACCOUNT_EXISTS → email існує → login ?next=invite (guided recovery §1.3.1)
 *   409 ROLE_NOT_STUDENT      → не STUDENT → error toast
 *   400 VALIDATION_ERROR      → fieldErrors на формі
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { invitesApi } from '@/api/invites'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { useRelationsStore } from '@/stores/relationsStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { getDefaultRouteForRole } from '@/config/routes'

export interface InviteRegisterForm {
  email: string
  password: string
  first_name?: string
  last_name?: string
  accept_privacy: boolean
  accept_terms: boolean
  accept_offer: boolean
}

export function useInviteAccept(token: string) {
  const { t } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const relationsStore = useRelationsStore()
  const auth = useAuthStore()

  const isAccepting = ref(false)
  const result = ref<any | null>(null)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]> | null>(null)

  /** Existing authenticated student → bond (без body). */
  async function accept(): Promise<void> {
    await run(() => invitesApi.acceptInvite(token))
  }

  /** Anonymous new student → register-inline + bond + login. */
  async function acceptWithRegistration(form: InviteRegisterForm): Promise<void> {
    await run(() => invitesApi.acceptInvite(token, { ...form }))
  }

  async function run(call: () => Promise<any>): Promise<void> {
    if (isAccepting.value) return
    isAccepting.value = true
    error.value = null
    fieldErrors.value = null
    try {
      const res = await call()

      // 201 LOGIN_REQUIRED — bond ВЖЕ зроблено, invite USED. Після login — одразу
      // dashboard (НЕ назад на used-invite, інакше "використане" = плутанина).
      if (res?.code === 'LOGIN_REQUIRED') {
        toast.success(t('invites.register.loginRequired'))
        router.push({ name: 'login' })
        return
      }

      // 201 + access — новий учень зареєстрований + залогінений
      if (res?.access) {
        auth.setAuth({ access: res.access, user: res.user })
        await auth.postAuthInit()
        await auth.ensureCsrfToken()
        auth.startProactiveRefresh()
        await relationsStore.fetchStudentRelations().catch(() => {})
        toast.success(t('invites.acceptSuccess', { tutorName: res?.invite?.tutor_info?.full_name || '' }))
        router.push(getDefaultRouteForRole(res?.user?.role || 'student'))
        return
      }

      // 200 — existing student bond
      result.value = res
      await relationsStore.fetchStudentRelations().catch(() => {})
      toast.success(t('invites.acceptSuccess', { tutorName: res?.tutor_info?.full_name || '' }))
    } catch (err: any) {
      const data = err?.response?.data || {}
      // BE віддає ДВІ форми помилок на цей endpoint:
      //  • view-level ручні Response → ПЛАСКО { code, error }  (INVITE_ACCOUNT_EXISTS,
      //    ROLE_NOT_STUDENT, RATE_LIMIT_EXCEEDED) — code UPPERCASE.
      //  • DRF exception_handler (serializer.is_valid raise) → ВКЛАДЕНО
      //    { error: { code: 'VALIDATION_ERROR', detail, fields } } (звірено ErrorCode:61).
      // Нормалізуємо обидві (джерело форми: backend apps/core/errors.py:279), інакше 400-
      // валідація випадала у generic 'UNKNOWN' → field-errors не показувались → юзер клікав
      // наосліп → BE replay-cache віддавав 429 (storm 2026-06-15).
      const nested = data.error && typeof data.error === 'object' ? data.error : null
      const code = String(data.code || nested?.code || 'UNKNOWN').toUpperCase()
      const fields = data.fields || nested?.fields || null

      // Guided recovery — email існує (409 пласко), bond НЕ зроблено, invite ACTIVE. Login з
      // redirect НАЗАД на invite → там authed-гілка показує Accept-кнопку → bond. LoginView
      // читає route.query.redirect (не "next" — звірено LoginView:358).
      if (code === 'INVITE_ACCOUNT_EXISTS') {
        toast.info(t('invites.register.accountExists'))
        router.push({ name: 'login', query: { redirect: `/invite/${token}` } })
        return
      }
      // Валідація (400 вкладено): пароль закороткий / email некоректний / consent → показати
      // помилки полів НА формі, щоб юзер бачив ЩО виправити (а не клікав повторно).
      if (code === 'VALIDATION_ERROR' && fields) {
        fieldErrors.value = fields
        return
      }
      error.value = code
      toast.error(t(`invites.errors.${code.toLowerCase()}`, t('invites.errors.unknown')))
    } finally {
      isAccepting.value = false
    }
  }

  function reset() {
    result.value = null
    error.value = null
    fieldErrors.value = null
  }

  return { isAccepting, result, error, fieldErrors, accept, acceptWithRegistration, reset }
}
