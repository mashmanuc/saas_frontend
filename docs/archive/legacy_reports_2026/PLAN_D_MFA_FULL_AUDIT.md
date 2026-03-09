# План D — Повний аудит і стабілізація MFA системи
**Дата:** 2026-02-26 (після глибокого аудиту реального коду)
**Пріоритет:** 🔴 КРИТИЧНО — безпека і функціональність
**Статус:** Аудит завершено — готово до виконання

---

## Архітектура MFA (реальна, після повного аудиту коду)

> ⚠️ ВАЖЛИВО: В проекті є **два паралельних** реалізації MFA:
> - **Новий** (правильний): `services/mfa.py` + `views_v1_auth.py` — backup codes хешуються через `make_password`
> - **Старий** (частково застарілий): `services/mfa_service.py` + `views_v1_mfa.py` — backup codes зберігаються plain text!
>
> Фронтенд використовує **обидва** ендпоінти! Setup/confirm → `views_v1_auth.py` (новий ✅), але disable → `views_v1_mfa.py` (старий ⚠️)

```
УСТАНОВКА (Setup Flow):
  MFASetupModal.vue → POST /v1/auth/mfa/setup  (views_v1_auth.py::V1AuthMFASetupView)
    → generate_totp_secret()  ← services/mfa.py  (20 bytes entropy ✅)
    → generate_backup_codes(10) + hash_backup_codes() ← make_password(PBKDF2) ✅
    → config.backup_codes_hashes = хешовані коди ✅
    → повертає {qr_svg, secret_hint, backup_codes: plain text для показу}
  ← Frontend показує QR + 10 backup codes + поле для OTP
  → POST /v1/auth/mfa/confirm  (views_v1_auth.py::V1AuthMFAConfirmView)
    → verify_totp(secret, otp) ← services/mfa.py
    → config.enabled_at = now()
  ← MFA увімкнено  ✅ Хешовані коди в БД

  АЛЕ ТАКОЖ ПАРАЛЕЛЬНО є:
  → POST /v1/auth/mfa/setup (views_v1_mfa.py::mfa_setup) — мертвий дублікат
    → MFAService.setup_mfa() ← services/mfa_service.py
    → backup_codes PLAIN TEXT в cache, потім PLAIN TEXT в БД ❌

ВХІД (Login Flow):
  LoginView.vue → POST /v1/auth/login  (views_v1_auth.py::LoginView)
    → перевіряє пароль
    → якщо mfa_config.enabled_at → MFALoginSession.create(expires_at=now+5хв)
    → повертає {mfa_required: True, session_id: mfa_login.id (UUID)}
  authStore.pendingMfaSessionId = session_id
  → POST /v1/auth/mfa/verify  (views_v1_auth.py::V1AuthMFAVerifyView) ✅
    → MFALoginSession.objects.filter(id=session_id).first()
    → verify_totp() або consume_backup_code() (check_password з хешем)
    → session.mfa_verified_at = now()
    → видає access + refresh tokens

BACKUP CODES (3 сценарії):
  1. Під час setup: показуються у MFASetupModal.vue (plain text → then hashed) ✅
  2. Перегляд після setup: BackupCodesModal.vue → request token → download
     → Backend повертає ТІЛЬКИ повідомлення (бо коди хешовані!) ⚠️
  3. Регенерація: BackupCodesModal.vue → authApi.regenerateBackupCodes(payload)
     → views_v1_mfa_regenerate.py → MFAService.verify_totp() + generate_backup_codes()
     → config.set_backup_codes(new_codes) → нові хешовані коди ✅
     → повертає plain text нових кодів для показу ✅

ВІДКЛЮЧЕННЯ (Disable Flow):
  MFAStatusWidget.vue → browser prompt() для OTP → authApi.disableMfa({otp})
    → POST /v1/auth/mfa/disable/  (views_v1_mfa.py::mfa_disable) ← СТАРИЙ!
    → MFAService.verify_mfa(user, otp) ← services/mfa_service.py ← PLAIN TEXT порівняння!
    → mfa_config.enabled_at = None
  ❌ Якщо коди були зашифровані views_v1_auth (PBKDF2) — disable через MFAService НЕ підтримує!
```

---

## ПОТОЧНИЙ СТАН КОМПОНЕНТІВ

### Файли Backend:
| Файл | Стан |
|------|------|
| `apps/users/services/mfa.py` | ✅ **ПРАВИЛЬНИЙ** — `verify_totp`, `hash_backup_codes` (PBKDF2), `consume_backup_code` |
| `apps/users/services/mfa_service.py` | ❌ **ЗАСТАРІЛИЙ** — `MFAService` з plain text backup codes! |
| `apps/users/api/views_v1_auth.py` | ✅ Основний: login + setup + confirm + verify (використовує `mfa.py`) |
| `apps/users/api/views_v1_mfa.py` | ⚠️ Дублює setup/confirm/disable/status (використовує `mfa_service.py`!) |
| `apps/users/api/views_v1_mfa_backup.py` | ⚠️ Download token — повертає тільки повідомлення (правильно для хешованих кодів) |
| `apps/users/api/views_v1_mfa_regenerate.py` | ✅ Регенерація з OTP + throttle 5/год — вимагає `otp_code` |
| `apps/users/models/extras.py` | ✅ Моделі UserMFAConfig, MFALoginSession |

### Файли Frontend:
| Файл | Стан |
|------|------|
| `modules/auth/views/LoginView.vue` | ✅ Логін + MFA step |
| `modules/auth/components/MFASetupModal.vue` | ✅ QR + backup codes під час setup |
| `modules/auth/components/MFAStatusWidget.vue` | ⚠️ prompt() для OTP при disable |
| `modules/auth/components/MFAVerifyModal.vue` | ⚠️ Тільки emit — нічого не робить сам |
| `modules/auth/components/BackupCodesModal.vue` | ❌ Показує повідомлення замість кодів |
| `api/mfa.ts` | ⚠️ disable() приймає password, але backend очікує otp |
| `modules/auth/store/authStore.js` | ✅ pendingMfaSessionId, verifyMfa() |

---

## ЗНАЙДЕНІ ПРОБЛЕМИ

### 🔴 КРИТИЧНО — Безпека

#### ПРОБЛЕМА S1: Два паралельних сервіси — split-brain архітектура
**Ситуація (підтверджено після повного аудиту):**

| Операція | Який views? | Який сервіс? | Хешування? |
|----------|------------|-------------|-----------|
| Setup + Confirm | `views_v1_auth.py` | `mfa.py` | ✅ PBKDF2 |
| Login Verify | `views_v1_auth.py` | `mfa.py` | ✅ check_password |
| Disable MFA | `views_v1_mfa.py` | `mfa_service.py` | ❌ plain text порівняння! |
| Regenerate codes | `views_v1_mfa_regenerate.py` | `mfa_service.py` | ✅ config.set_backup_codes() |
| Status | `views_v1_mfa.py` | `mfa_service.py` | n/a |

**Критична несумісність:** `mfa_service.py::verify_mfa()` шукає OTP у backup codes через:
```python
if otp.upper() in mfa_config.backup_codes_hashes:  # ← plain text порівняння!
```
Але `views_v1_auth.py` зберігає backup codes як PBKDF2 хеші через `make_password`.
**Результат:** `mfa_disable` endpoint НІКОЛИ не зможе верифікувати backup code для відключення MFA!

**Виправлення:** Замінити `mfa_service.py::verify_mfa()` на виклик `mfa.py::consume_backup_code`:
```python
# views_v1_mfa.py::mfa_disable — замінити:
# БУЛО:
if not MFAService.verify_mfa(user, otp):

# СТАЛО (використовувати правильний сервіс):
from apps.users.services.mfa import verify_totp, consume_backup_code
mfa_config = user.mfa_config
ok = verify_totp(secret=mfa_config.secret, otp=otp)
if not ok:
    matched, _ = consume_backup_code(otp=otp, hashes=list(mfa_config.backup_codes_hashes or []))
    ok = matched
if not ok:
    return error_response(...)
```

#### ПРОБЛЕМА S2: TOTP secret зберігається plain text
**Файл:** `backend/apps/users/models/extras.py` рядок 216
```python
secret = models.CharField(max_length=128, blank=True, default='')  # plain text!
```
**Ризик:** При витоку БД зловмисник може відновити TOTP токени будь-якого користувача.

**Виправлення:**
```python
# Використати Django's encrypted field або шифрування перед збереженням:
# pip install django-encrypted-model-fields
from encrypted_model_fields.fields import EncryptedCharField

class UserMFAConfig(TimeStampedModel):
    secret = EncryptedCharField(max_length=256, blank=True, default='')
```
Або ручне шифрування через `settings.SECRET_KEY` + `Fernet`.

#### ПРОБЛЕМА S3: Мертвий `mfa_verify` код в `views_v1_mfa.py` — crash при виклику
**Статус urls_v1.py (перевірено):**
- `V1AuthMFAVerifyView` з `views_v1_auth.py` — **використовується** (рядок 89 urls)
- `mfa_verify` з `views_v1_mfa.py` — **НЕ підключена до URL!** (мертвий код)
- Але `mfa_setup`, `mfa_confirm`, `mfa_disable`, `mfa_status` — з `views_v1_mfa.py` **підключені**!

**Проблема:** `views_v1_mfa.py::mfa_verify` — мертвий, але небезпечний код:
```python
# views_v1_mfa.py::mfa_verify — НЕРОБОЧИЙ КОД (не підключений до URL, але існує):
mfa_session = MFALoginSession.objects.get(session_id=session_id, verified=False)
# ❌ MFALoginSession НЕ має полів session_id і verified! → FieldError
if mfa_session.is_expired():  # ❌ метод is_expired() відсутній в моделі!
```
**Ризик:** Якщо хтось підключить цей URL у майбутньому — впаде з `FieldError`. Потребує видалення або виправлення.

#### ПРОБЛЕМА S4: `views_v1_mfa.py` — setup/confirm/disable/status без rate limiting
**Файл:** `backend/apps/users/api/views_v1_mfa.py`
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_setup(request):  # ← немає throttle!
# ...
def mfa_confirm(request):  # ← немає throttle!
# ...
def mfa_disable(request):  # ← немає throttle! OTP brute force!
```
**Ризик для `mfa_disable`:** Можна перебрати OTP і відключити MFA жертви якщо session активна.

---

### 🟠 СЕРЙОЗНО — Функціональність

#### ПРОБЛЕМА F1: Переглянути backup codes після setup НЕМОЖЛИВО
**Файл:** `backend/apps/users/api/views_v1_mfa_backup.py` рядки 91-108
```python
# Backend ВІДМОВЛЯЄТЬСЯ повертати коди:
return Response({
    'message': 'Backup codes were provided during MFA setup. Contact support if you lost them.',
    'backup_codes_count': len(config.backup_codes_hashes or []),
}, status=status.HTTP_200_OK)
```

**Файл:** `frontend/src/modules/auth/components/BackupCodesModal.vue` рядки 124-128
```javascript
// Frontend коректно обробляє це повідомлення:
if (res?.message) {
    infoMessage.value = res.message  // ← показує "зверніться до підтримки"
    codes.value = []
}
```
**Ризик UX:** Якщо користувач не завантажив коди під час setup — він не може їх переглянути. При втраті телефона — заблокований аккаунт без можливості відновлення.

**Виправлення (після вирішення S1 — хешування):**
```python
# Оскільки після хешування коди незворотні, ПОТРІБНО:
# Варіант А: Зберігати і хеш і partial view (перші 4 символи) для UX
# Варіант Б: Дозволити перегенерацію як єдиний спосіб
# Варіант В (поточний): Показувати тільки кількість залишених кодів + кнопку регенерації
```

Якщо backup codes зберігаються plain text (поточний стан) — повернути їх можна. Якщо хешуємо — тільки регенерація.

**Поточне рішення для UX (без зміни безпеки):**
В `BackupCodesModal.vue` замість "зверніться до підтримки" показувати:
```
"Коди були показані під час налаштування 2FA. Якщо ви їх не зберегли,
використайте регенерацію нижче. Старі коди стануть недійсними."
```
+ Кнопка "Регенерувати коди" завжди видима.

#### ПРОБЛЕМА F2: `api/mfa.ts` — неправильний payload для `disable()`
**Файл:** `frontend/src/api/mfa.ts` рядок 47
```typescript
export interface MFADisablePayload {
    password: string  // ❌ Backend очікує otp, не password!
}

disable(payload: MFADisablePayload): Promise<{ status: string }> {
    return apiClient.post('/v1/auth/mfa/disable', payload)
}
```
**Файл:** `backend/apps/users/api/views_v1_mfa.py` рядок 117
```python
otp = request.data.get('otp')  # очікує 'otp'!
```
**Файл:** `frontend/src/modules/auth/components/MFAStatusWidget.vue` рядок 109
```javascript
await authApi.disableMfa({ otp })  // ← правильно! otp передається
```
**Але:** `authApi.disableMfa` vs `mfaApi.disable` — два різні клієнти. `authApi.disableMfa` може мати правильний payload.

#### ПРОБЛЕМА F3: MFAVerifyModal.vue не виконує API-запит
**Файл:** `frontend/src/modules/auth/components/MFAVerifyModal.vue` рядки 84-101
```javascript
async function handleSubmit() {
    loading.value = true
    try {
        emit('success', { otp: otp.value })  // ← тільки emit! Нічого не робить!
    } catch (err: any) {
        // Помилка ніколи не виникне — тут немає await
    } finally {
        loading.value = false
    }
}
```
Компонент **тільки повертає OTP через emit**. Реальний API-виклик робить батьківський компонент. Це правильний патерн якщо батьківський компонент обробляє верифікацію — але потрібно перевірити де використовується цей компонент.

#### ПРОБЛЕМА F4: Немає окремого поля для backup code при логіні
**Файл:** `frontend/src/modules/auth/views/LoginView.vue` рядок 77-102
OTP і backup code вводяться в одне поле. `MFAVerifyModal.vue` має кнопку "Використати резервний код" → `emit('useBackupCode')` — але LoginView не використовує `MFAVerifyModal`. LoginView має власний inline OTP step з `resendOtp()` і `backToPassword()`, але **немає** кнопки "Використати резервний код".

Є посилання "Forgot your phone?" / backup code — але в LoginView step=`'otp'` цього немає!

#### ПРОБЛЕМА F5: MFAStatusWidget не показує кількість залишених backup codes
**Файл:** `frontend/src/modules/auth/components/MFAStatusWidget.vue`
```html
<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
    <p class="font-semibold">{{ $t('auth.mfa.status.backupCodesInfoTitle') }}</p>
    <p class="mt-1">{{ $t('auth.mfa.status.backupCodesInfoDescription') }}</p>
    <!-- ❌ Немає посилання на BackupCodesModal! -->
    <!-- ❌ Немає відображення кількості залишених кодів! -->
</div>
```
`mfa_status` endpoint повертає `backup_codes_remaining`, але `MFAStatusWidget` його не показує.

---

### 🟡 СЕРЕДНІЙ — UX / Якість

#### ПРОБЛЕМА U1: `prompt()` для OTP при відключенні MFA
**Файл:** `frontend/src/modules/auth/components/MFAStatusWidget.vue` рядок 96
```javascript
const otp = prompt(t('auth.mfa.status.otpPrompt'))  // ❌ browser native prompt()!
```
**Проблеми:**
- Нативний `prompt()` не стилізований, виглядає архаїчно
- Не підтримує `inputmode="numeric"` — складно ввести на мобільному
- Не підтримує `autocomplete="one-time-code"` — SMS автозаповнення не працює
- Блокує event loop

**Виправлення:** Замінити на MFAVerifyModal або inline Input компонент.

#### ПРОБЛЕМА U2: Немає сторінки/флоу "Втратив телефон"
**Ситуація:** Якщо користувач загубив телефон і всі backup codes — аккаунт заблокований.
**Відсутній флоу:**
```
Логін → "Проблеми з двофакторкою?"
  → "Використати резервний код" (вже є в MFAVerifyModal)
  → "Немає резервних кодів? Зв'яжіться з підтримкою" (ВІДСУТНЄ)
```
Немає ні посилання на підтримку, ні форми відновлення аккаунту при втраті MFA.

#### ПРОБЛЕМА U3: Backup codes показуються на одній сторінці з QR
**Файл:** `frontend/src/modules/auth/components/MFASetupModal.vue` рядки 21-32
QR код і backup codes — на одному екрані. Це може призвести до того що користувач бачить QR → сканує → закриває, не зберігши коди.
**Виправлення:** Розділити на кроки:
1. Крок 1: QR + секрет + поле OTP
2. Крок 2 (тільки після підтвердження): Backup codes (з обов'язковим підтвердженням "я зберіг коди")

#### ПРОБЛЕМА U4: `BackupCodesModal` — регенерація без OTP підтвердження
**Файл:** `frontend/src/modules/auth/components/BackupCodesModal.vue` рядок 140-155
```javascript
async function regenerateCodes() {
    if (!confirm(t('profile.security.mfa.regenerateConfirm'))) return
    // ...
    const res = await authApi.regenerateBackupCodes()  // ← нічого не передає!
}
```
**Файл:** `frontend/src/modules/auth/api/authApi.js` рядок 48
```javascript
regenerateBackupCodes(payload) {
    return api.post('/v1/auth/mfa/backup-codes/regenerate/', payload)
}
```
**Файл:** `backend/apps/users/api/views_v1_mfa_regenerate.py` рядок 24
```python
otp_code = request.data.get('otp_code')
if not otp_code:
    return Response({'error': 'validation_failed', ...}, status=422)
```
**Результат:** `BackupCodesModal.vue` не передає `otp_code` → backend відповідає 422!
Регенерація через `BackupCodesModal` **взагалі не працює** в поточному стані!

#### ПРОБЛЕМА U5: MFAStatusWidget не показує коли MFA було увімкнено
`mfa_status` повертає `enabled_at`, але `MFAStatusWidget` його не відображає.

---

## СХЕМА ПОВНОГО ПРАВИЛЬНОГО MFA ФЛОУ

```
╔════════════════════════════════════════╗
║           SETUP FLOW (правильний)       ║
╠════════════════════════════════════════╣
║ 1. Генерація: POST /mfa/setup           ║
║    ← {qr_svg, secret_hint, backup_codes}║
║ 2. Крок 1: QR Code + Scan + OTP input  ║
║    → POST /mfa/confirm {otp}            ║
║    ← {enabled_at, backup_codes_count}  ║
║ 3. Крок 2: Backup codes з checkboxes   ║
║    "✓ Я зберіг ці коди в безпечному місці"║
║    [Завантажити .txt] [Скопіювати]     ║
║ 4. Успішна активація                   ║
╚════════════════════════════════════════╝

╔════════════════════════════════════════╗
║           LOGIN FLOW (правильний)       ║
╠════════════════════════════════════════╣
║ 1. POST /auth/login {email, password}  ║
║    ← {mfa_required: true, session_id} ║
║ 2. OTP Input:                          ║
║    - Стандартний 6-значний код         ║
║    - АБО backup code (8 символів)      ║
║    - Посилання "Втратив доступ?"       ║
║ 3. POST /auth/mfa/verify {session_id, otp}║
║    ← {access} + refresh cookie         ║
║ 4. Bootstrap + редірект                ║
╚════════════════════════════════════════╝

╔════════════════════════════════════════╗
║       DISABLE FLOW (правильний)         ║
╠════════════════════════════════════════╣
║ 1. Кнопка "Відключити 2FA"             ║
║ 2. Модальне вікно (НЕ prompt()):       ║
║    "Введіть код з authenticator"       ║
║    [OTP Input] [Відмінити] [Підтвердити]║
║ 3. POST /auth/mfa/disable {otp}        ║
║ 4. Успішне відключення + повідомлення  ║
╚════════════════════════════════════════╝

╔════════════════════════════════════════╗
║     BACKUP CODES FLOW (правильний)      ║
╠════════════════════════════════════════╣
║ Під час Setup:                         ║
║   → 8 кодів показуються один раз       ║
║   → [Завантажити] [Скопіювати]         ║
║   → Checkbox "Я зберіг коди"           ║
║                                        ║
║ В налаштуваннях (після setup):         ║
║   → Показується кількість залишених    ║
║   → Кнопка "Переглянути" (якщо plain) ║
║     АБО "Регенерувати" (якщо хеш)     ║
║   → При регенерації:                   ║
║     - OTP підтвердження               ║
║     - Нові 8 кодів (старі анульовані) ║
║                                        ║
║ При логіні (backup code):              ║
║   → Те саме поле OTP — backend сам    ║
║     визначить чи це TOTP чи backup    ║
║   → Після використання — -1 код       ║
║   → При 0 кодів — попередження!       ║
╚════════════════════════════════════════╝

╔════════════════════════════════════════╗
║     ВІДНОВЛЕННЯ ДОСТУПУ (бажане)        ║
╠════════════════════════════════════════╣
║ "Не можу увійти з 2FA" →              ║
║   1. Ввести backup code               ║
║   2. "Немає кодів?" → форма запиту    ║
║      до адміністратора:               ║
║      - Email верифікація              ║
║      - Документ підтвердження         ║
║      Admin → reset MFA для користувача║
╚════════════════════════════════════════╝
```

---

## ПОРЯДОК ВИПРАВЛЕНЬ

### Крок 1: КРИТИЧНО — Безпека (Backend) ~2-3 год

#### 1.1 Видалити мертвий `mfa_verify` з `views_v1_mfa.py`

**Підтверджено (urls_v1.py перевірено):** `mfa_verify` з `views_v1_mfa.py` НЕ підключений до URL. Але він є в файлі і може ввести в оману розробника.

**Файл:** `backend/apps/users/api/views_v1_mfa.py`

Видалити весь блок `mfa_verify` (рядки 56-109) або додати коментар:
```python
# DEPRECATED: This function is NOT used. MFA verify is handled by
# views_v1_auth.py::MFAVerifyView (path: auth/mfa/verify)
# This code has bugs: MFALoginSession has no 'session_id' or 'verified' fields!
```

#### 1.2 Додати rate limiting на `mfa_disable` в `views_v1_mfa.py`

**Файл:** `backend/apps/users/api/views_v1_mfa.py`

```python
from rest_framework.throttling import UserRateThrottle

class MFAOperationThrottle(UserRateThrottle):
    rate = '10/hour'  # Захист від brute force OTP при disable

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([MFAOperationThrottle])  # ← ДОДАТИ
def mfa_disable(request):
    # ...
```

#### 1.3 Перевірити rate limiting на `V1AuthMFAVerifyView`

**Файл:** `backend/apps/users/api/views_v1_auth.py`

```bash
grep -A 10 "class MFAVerifyView\|class V1AuthMFAVerifyView" \
    backend/apps/users/api/views_v1_auth.py
```

Якщо `throttle_classes` не встановлено — додати:
```python
class V1AuthMFAVerifyView(VAuthAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'mfa_verify'
```

**Файл:** `backend/config/settings/*.py`
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'mfa_verify': '10/hour',
    }
}
```

#### 1.3 Виправити `mfa_disable` — використовувати правильний сервіс `mfa.py`

**Проблема (підтверджено):** `views_v1_mfa.py::mfa_disable` → `MFAService.verify_mfa()` → порівнює plain text OTP з PBKDF2-хешами → завжди повертає `False` для backup codes!

**Файл:** `backend/apps/users/api/views_v1_mfa.py`

```python
# ПОТОЧНИЙ КОД (НЕПРАВИЛЬНИЙ):
if not MFAService.verify_mfa(user, otp):
    return Response({'error': 'mfa_invalid_code'}, ...)

# ВИПРАВЛЕНИЙ КОД:
from apps.users.services.mfa import verify_totp, consume_backup_code

mfa_config = getattr(user, 'mfa_config', None)
if not mfa_config or not mfa_config.enabled_at:
    return Response({'error': 'mfa_not_enabled'}, status=404)

ok = verify_totp(secret=mfa_config.secret, otp=otp)
if not ok:
    matched, remaining = consume_backup_code(
        otp=otp,
        hashes=list(mfa_config.backup_codes_hashes or [])
    )
    if matched:
        mfa_config.backup_codes_hashes = remaining
        mfa_config.save(update_fields=['backup_codes_hashes'])
        ok = True

if not ok:
    return Response({'error': 'mfa_invalid_code'}, status=422)
```

#### 1.4 Перевірити і виправити стан backup codes в БД

Через split-brain (деякі юзери могли ввімкнути MFA через `views_v1_mfa.py` якщо URL був підключений раніше):
```bash
python manage.py shell -c "
from apps.users.models import UserMFAConfig
from django.contrib.auth.hashers import is_password_usable
configs = UserMFAConfig.objects.filter(enabled_at__isnull=False)
plain_text_users = []
for c in configs:
    for code in c.backup_codes_hashes:
        if not is_password_usable(str(code)):
            plain_text_users.append(c.user_id)
            break
print(f'Users with unhashed backup codes: {len(plain_text_users)}')
print(plain_text_users)
"
```

Для знайдених юзерів — примусова регенерація або міграція даних.

---

### Крок 2: СЕРЙОЗНО — Функціональність Frontend ~3-4 год

#### 2.1 Замінити `prompt()` на модальне вікно

**Файл:** `frontend/src/modules/auth/components/MFAStatusWidget.vue`

Замість:
```javascript
async function handleDisable() {
    if (!confirm(t('auth.mfa.status.disableConfirm'))) return
    const otp = prompt(t('auth.mfa.status.otpPrompt'))
    // ...
}
```
Потрібно:
1. Додати `ref showDisableModal = false`
2. Додати компонент MFADisableModal або використати MFAVerifyModal
3. При успіху `emit('success', { otp })` → викликати `authApi.disableMfa({ otp })`

Мінімальне виправлення без нового компонента — через inline стейт:
```html
<!-- Додати в template після "enabled" блоку: -->
<div v-if="showOtpInput" class="space-y-3">
    <Input
        v-model="disableOtp"
        :label="$t('auth.mfa.status.otpLabel')"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
    />
    <div class="flex gap-2">
        <Button @click="confirmDisable" :loading="loading" variant="destructive">
            {{ $t('auth.mfa.status.confirmDisable') }}
        </Button>
        <Button variant="outline" @click="showOtpInput = false">
            {{ $t('common.cancel') }}
        </Button>
    </div>
</div>
```

#### 2.2 Додати "Використати резервний код" в LoginView

**Файл:** `frontend/src/modules/auth/views/LoginView.vue`

В `step === 'otp'` блоці (`<form v-else ...>`) додати:
```html
<div class="text-sm text-muted-foreground mt-2">
    <button
        type="button"
        class="hover:underline"
        style="color: var(--accent);"
        @click="toggleBackupCodeMode"
    >
        {{ isBackupCodeMode
            ? $t('auth.login.useTotp')
            : $t('auth.login.useBackupCode')
        }}
    </button>
</div>
```

```javascript
const isBackupCodeMode = ref(false)
// При backup code mode — змінити placeholder і maxlength:
// TOTP: 6 цифр, inputmode="numeric"
// Backup: 8 символів, inputmode="text"
```

#### 2.3 Показати `backup_codes_remaining` в MFAStatusWidget

**Файл:** `frontend/src/modules/auth/components/MFAStatusWidget.vue`

```javascript
// Додати до state:
const backupCodesRemaining = ref(null)

// В checkMfaStatus():
const res = await authApi.getMfaStatus()
mfaEnabled.value = res?.enabled || false
backupCodesRemaining.value = res?.backup_codes_remaining ?? null
```

```html
<!-- В template після "enabled" статусу: -->
<div class="text-sm text-muted-foreground">
    {{ $t('auth.mfa.status.backupCodesRemaining', { count: backupCodesRemaining }) }}
    <!-- Якщо 0 — червоне попередження! -->
    <span v-if="backupCodesRemaining === 0" class="text-red-600 font-medium">
        {{ $t('auth.mfa.status.noCodesWarning') }}
    </span>
</div>
<Button variant="outline" size="sm" @click="showBackupCodesModal = true">
    {{ $t('auth.mfa.status.viewBackupCodes') }}
</Button>
```

#### 2.4 Поліпшити BackupCodesModal — показувати кнопку регенерації завжди

**Файл:** `frontend/src/modules/auth/components/BackupCodesModal.vue`

Поточний стан: `infoMessage` показується замість кодів, кнопка регенерації у footer завжди є.

Потрібно поліпшити UX тексту коли коди недоступні:
```html
<div v-else-if="infoMessage" class="info-box">
    <AlertCircle :size="18" />
    <div>
        <p class="info-title">{{ $t('profile.security.mfa.backupCodesNotAvailable') }}</p>
        <p class="info-text">{{ $t('profile.security.mfa.backupCodesRegenerateHint') }}</p>
        <!-- Замість: "Contact support if you lost them" -->
        <!-- Краще: "Згенеруйте нові коди нижче. Старі коди при цьому анулюються." -->
    </div>
</div>
```

#### 2.5 Виправити MFASetupModal — backup codes на окремому кроці

**Файл:** `frontend/src/modules/auth/components/MFASetupModal.vue`

Поточний стан: QR + backup codes + OTP на одному кроці.

Покращений флоу:
```
step: 'qr' → QR + secret hint + OTP поле → [Підтвердити]
step: 'backup' → backup codes + download + [✓ Я зберіг коди] checkbox → [Завершити]
step: 'success' → Успіх!
```

```javascript
const step = ref<'qr' | 'backup' | 'success'>('qr')
const confirmedBackupCodes = ref(false)

// Після confirm_mfa успіху:
step.value = 'backup'  // показуємо backup codes

// В backup step:
// Кнопка "Завершити" активна тільки після confirmedBackupCodes = true
```

#### 2.6 Виправити `BackupCodesModal` — регенерація НЕ ПРАЦЮЄ (передати OTP)

**Проблема підтверджена:** Backend вимагає `otp_code`, frontend не передає → 422.

**Файл:** `frontend/src/modules/auth/components/BackupCodesModal.vue`

```javascript
// Замінити regenerateCodes():
async function regenerateCodes() {
    if (!confirm(t('profile.security.mfa.regenerateConfirm'))) return

    // Потрібно запитати OTP перед регенерацією:
    const otpCode = prompt(t('profile.security.mfa.otpForRegenerate'))
    // (або замінити prompt на inline Input — але це мінімальний фікс)
    if (!otpCode) return

    loading.value = true
    error.value = ''
    try {
        const res = await authApi.regenerateBackupCodes({ otp_code: otpCode })  // ← передаємо otp_code
        codes.value = Array.isArray(res?.codes) ? res.codes : []
        infoMessage.value = ''
    } catch (err) {
        const errCode = err?.response?.data?.error
        if (errCode === 'mfa_invalid_code') {
            error.value = t('profile.security.mfa.errors.invalidOtpForRegenerate')
        } else {
            error.value = err?.response?.data?.message || t('profile.security.mfa.errors.regenerateFailed')
        }
    } finally {
        loading.value = false
    }
}
```

**i18n додати:**
```json
{
    "profile.security.mfa.otpForRegenerate": "Введіть код з authenticator для підтвердження",
    "profile.security.mfa.errors.invalidOtpForRegenerate": "Невірний код підтвердження"
}
```

---

### Крок 3: СЕРЕДНІЙ — UX / Якість ~1-2 год

#### 3.1 Посилання "Втратив доступ до телефона" в LoginView

**Файл:** `frontend/src/modules/auth/views/LoginView.vue`

```html
<form v-else class="space-y-4" @submit.prevent="onSubmitOtp">
    <!-- ... існуючий контент ... -->

    <!-- Додати в кінці: -->
    <div class="text-center text-sm text-muted-foreground">
        {{ $t('auth.login.lostPhone') }}
        <a href="mailto:support@m4sh.org" style="color: var(--accent);" class="hover:underline">
            {{ $t('auth.login.contactSupport') }}
        </a>
    </div>
</form>
```

#### 3.2 Показати дату увімкнення MFA в MFAStatusWidget

**Файл:** `frontend/src/modules/auth/components/MFAStatusWidget.vue`

```javascript
const enabledAt = ref(null)

// В checkMfaStatus():
enabledAt.value = res?.enabled_at || null
```

```html
<div v-if="enabledAt" class="text-xs text-muted-foreground">
    {{ $t('auth.mfa.status.enabledAt', { date: formatDate(enabledAt) }) }}
</div>
```

#### 3.3 i18n ключі для нових текстів

**Файл:** `frontend/src/i18n/uk.json`

Перевірити і додати відсутні ключі:
```json
{
    "auth": {
        "login": {
            "useBackupCode": "Використати резервний код",
            "useTotp": "Використати код з додатку",
            "lostPhone": "Немає доступу до телефона?",
            "contactSupport": "Зв'яжіться з підтримкою"
        },
        "mfa": {
            "status": {
                "backupCodesRemaining": "Залишилось резервних кодів: {count}",
                "noCodesWarning": "⚠️ У вас немає резервних кодів! Згенеруйте нові.",
                "enabledAt": "Активовано: {date}",
                "viewBackupCodes": "Переглянути резервні коди",
                "confirmDisable": "Підтвердити відключення"
            }
        }
    },
    "profile": {
        "security": {
            "mfa": {
                "backupCodesRegenerateHint": "Для безпеки коди видно лише під час налаштування. Натисніть «Регенерувати» щоб отримати нові коди (старі анулюються)."
            }
        }
    }
}
```

---

### Крок 4: Перевірити Backend Login Flow (urls_v1.py)

```bash
# Перевірити які URL підключені:
grep -n "mfa" backend/apps/users/api/urls_v1.py
```

**Очікуваний результат:**
```
# Основний login і verify — в views_v1_auth.py:
path('auth/login', LoginView.as_view(), ...)
path('auth/mfa/verify', MFAVerifyView.as_view(), ...)

# Setup/confirm/disable/status — в views_v1_mfa.py:
path('auth/mfa/setup', mfa_setup, ...)
path('auth/mfa/confirm', mfa_confirm, ...)
path('auth/mfa/disable', mfa_disable, ...)
path('auth/mfa/status/', mfa_status, ...)

# Backup codes — в views_v1_mfa_backup.py:
path('auth/mfa/backup-codes/regenerate/', ...),
path('auth/mfa/backup-codes/request/', ...),
path('auth/mfa/backup-codes/<str:token>/', ...),
```

---

## ЗВЕДЕНА ТАБЛИЦЯ ПРОБЛЕМ

| # | Проблема | Тип | Файл(и) | Пріоритет |
|---|----------|-----|---------|-----------|
| **S1** | Split-brain: `mfa_disable` через `MFAService` (plain text) vs backup codes (PBKDF2) → disable backup code НІКОЛИ не спрацює | 🔴 Безпека + Функціонал | `views_v1_mfa.py`, `mfa_service.py` | **КРИТИЧНО** |
| **S2** | Відсутній rate limiting на `V1AuthMFAVerifyView` → brute force 6-значного OTP | 🔴 Безпека | `views_v1_auth.py` | **КРИТИЧНО** |
| **S3** | Мертвий `mfa_verify` в `views_v1_mfa.py` — FieldError при підключенні (`session_id`, `verified`, `is_expired()` відсутні в моделі) | 🔴 Безпека | `views_v1_mfa.py` | **КРИТИЧНО** |
| **S4** | `mfa_disable` без rate limiting → brute force OTP для відключення MFA активного сеансу | 🔴 Безпека | `views_v1_mfa.py` | **КРИТИЧНО** |
| **S5** | TOTP secret зберігається plain text в БД → при витоку можна відтворити всі TOTP | 🔴 Безпека | `extras.py` (довгостроково) | СЕРЙОЗНО |
| **F1** | `BackupCodesModal::regenerateCodes()` не передає `otp_code` → backend 422 → регенерація НЕ ПРАЦЮЄ | 🟠 Функціонал | `BackupCodesModal.vue` | **СЕРЙОЗНО** |
| **F2** | Немає "використати backup code" у `LoginView.vue` step=otp (є в `MFAVerifyModal` але він не використовується в LoginView) | 🟠 Функціонал | `LoginView.vue` | СЕРЙОЗНО |
| **F3** | Переглянути backup codes після setup неможливо (хешовані) — тільки регенерація | 🟠 UX/Функціонал | `views_v1_mfa_backup.py` | СЕРЙОЗНО |
| **F4** | `api/mfa.ts::disable()` — payload тип `{password}`, backend очікує `{otp}` (TypeScript помилка) | 🟡 Якість | `api/mfa.ts` | СЕРЕДНІЙ |
| **U1** | `prompt()` для OTP при disable — нативний браузерний діалог, погана UX | 🟡 UX | `MFAStatusWidget.vue` | СЕРЕДНІЙ |
| **U2** | Немає флоу "Втратив телефон / відновлення доступу" | 🟡 UX | `LoginView.vue` | СЕРЕДНІЙ |
| **U3** | Backup codes і QR на одному екрані setup — ризик не зберегти коди | 🟡 UX | `MFASetupModal.vue` | СЕРЕДНІЙ |
| **U4** | `backup_codes_remaining` та `enabled_at` не відображаються в `MFAStatusWidget` | ⚪ UX | `MFAStatusWidget.vue` | НИЗЬКИЙ |
| **U5** | Telemetry: немає логування failed OTP спроб → нема audit trail атак | ⚪ Аудит | backend `views_v1_auth.py` | НИЗЬКИЙ |

---

## ОЧІКУВАНИЙ РЕЗУЛЬТАТ ПІСЛЯ ВИПРАВЛЕНЬ

```
Backend (безпека):
  ✅ mfa_disable коректно верифікує OTP/backup через mfa.py (PBKDF2)
  ✅ Rate limiting 10/год на V1AuthMFAVerifyView
  ✅ Rate limiting 10/год на mfa_disable
  ✅ Мертвий mfa_verify видалений/задепрекейтований
  ✅ TOTP secret шифрується (довгостроково, потребує міграції)

Setup Flow:
  ✅ QR код на першому кроці
  ✅ Backup codes на окремому кроці після підтвердження OTP
  ✅ Checkbox "Я зберіг ці коди" + Download + Copy
  ✅ 10 кодів (вже реалізовано в views_v1_auth.py)

Login Flow:
  ✅ MFA step з підтримкою TOTP і backup codes (8 символів)
  ✅ Кнопка "Використати резервний код" з відповідним UX
  ✅ Посилання "Немає доступу? → Підтримка"

Settings / Backup Codes:
  ✅ Регенерація кодів ПЕРЕДАЄ otp_code → backend 200 OK
  ✅ Відображається кількість залишених кодів + дата ввімкнення
  ✅ Попередження якщо 0 кодів залишилось
  ✅ Чіткий текст коли коди недоступні + кнопка регенерації

Disable Flow:
  ✅ Inline OTP input замість prompt()
  ✅ Backend коректно приймає OTP і backup codes
```

---

## Додаток: Staff Admin MFA Reset

**Файл:** `frontend/src/modules/staff/views/StaffUserOverviewView.vue`

Існує можливість для адмінів скидати MFA — перевірити що вона:
1. Вимагає підтвердження
2. Логується в аудит
3. Відправляє email користувачу про скидання MFA

```bash
grep -n "reset_mfa\|resetMfa\|mfa_reset" \
    frontend/src/modules/staff/views/StaffUserOverviewView.vue
```
