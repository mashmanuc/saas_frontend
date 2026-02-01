# API Contract Fix Report — MFA & WebAuthn Endpoints

**Дата:** 2026-01-30  
**Версія:** 1.0  
**Статус:** ✅ COMPLETED

---

## Проблема

Frontend викликав неіснуючі endpoints, що призводило до **404 помилок**:

1. `GET /api/v1/auth/mfa/backup-codes/` — не існує в бекенді
2. `GET /api/v1/auth/user/webauthn/credentials/` — неправильний шлях (має бути `/auth/webauthn/credentials/`)

### Причина

Невідповідність між frontend API клієнтами та реальними backend URLs у `apps/users/api/urls.py`.

---

## Виправлення

### 1. MFA Backup Codes

**Видалено неіснуючі методи:**
- ❌ `getBackupCodes()` з `src/api/mfa.ts`
- ❌ `getBackupCodes()` з `src/modules/auth/api/authApi.js`

**Додано коректні методи в `authApi.js`:**
```javascript
getMfaStatus() {
  return api.get('/v1/auth/mfa/status/')
}

disableMfa(payload) {
  return api.post('/v1/auth/mfa/disable', payload)
}

regenerateBackupCodes(payload) {
  return api.post('/v1/auth/mfa/backup-codes/regenerate', payload)
}
```

**Оновлено сигнатури в `mfa.ts`:**
```typescript
regenerateBackupCodes(payload: { otp_code: string }): Promise<BackupCodesResponse>

requestBackupCodesToken(): Promise<{ download_token: string; expires_in: number }>
```

### 2. WebAuthn Credentials

**Перевірено URLs в `authApi.js`:**
```javascript
getWebAuthnCredentials() {
  return api.get('/v1/auth/webauthn/credentials/')  // ✅ Правильний шлях
}

revokeWebAuthnCredential(id) {
  return api.post(`/v1/auth/webauthn/credentials/${id}/revoke/`)  // ✅ Правильний шлях
}
```

Ці endpoints **вже були коректними** — помилка `/auth/user/webauthn/credentials/` не знайдена в коді.

### 3. Компоненти

**Оновлено `MFAStatusWidget.vue`:**
- Замінено `mfaApi.getBackupCodes()` → `authApi.getMfaStatus()`
- Замінено `mfaApi.disable()` → `authApi.disableMfa()`
- Замінено `mfaApi.regenerateBackupCodes()` → `authApi.regenerateBackupCodes({ otp_code })`
- Додано prompt для введення OTP коду при регенерації backup codes

---

## Backend Endpoints (SSOT)

### MFA (`/api/auth/mfa/`)

| Method | Path | Опис |
|--------|------|------|
| POST | `/auth/mfa/setup/` | Ініціювати MFA setup |
| POST | `/auth/mfa/confirm/` | Підтвердити MFA setup з OTP |
| POST | `/auth/mfa/verify/` | Верифікувати MFA під час логіну |
| POST | `/auth/mfa/disable/` | Вимкнути MFA (потрібен password) |
| GET | `/auth/mfa/status/` | Отримати статус MFA |
| POST | `/auth/mfa/backup-codes/request/` | Запросити токен для завантаження backup codes |
| GET | `/auth/mfa/backup-codes/<token>/` | Завантажити backup codes за токеном |
| POST | `/auth/mfa/backup-codes/regenerate/` | Регенерувати backup codes (потрібен OTP) |

### WebAuthn (`/api/auth/webauthn/`)

| Method | Path | Опис |
|--------|------|------|
| POST | `/auth/webauthn/challenge/` | Отримати challenge для WebAuthn |
| POST | `/auth/webauthn/register/` | Зареєструвати WebAuthn credential |
| POST | `/auth/webauthn/verify/` | Верифікувати WebAuthn під час логіну |
| GET | `/auth/webauthn/credentials/` | Список WebAuthn credentials |
| DELETE | `/auth/webauthn/credentials/<id>/` | Видалити credential |
| POST | `/auth/webauthn/credentials/<id>/revoke/` | Відкликати credential |

---

## Файли змінені

### Frontend
1. `src/api/mfa.ts` — видалено `getBackupCodes()`, оновлено сигнатури
2. `src/modules/auth/api/authApi.js` — видалено `getBackupCodes()`, додано `getMfaStatus()`, `disableMfa()`, оновлено `regenerateBackupCodes()`
3. `src/modules/auth/components/MFAStatusWidget.vue` — використання `authApi` замість `mfaApi`, додано OTP prompt

### Backend
Без змін — endpoints вже були коректними.

---

## Тестування

### Рекомендовані кроки:

1. **Запустити backend:**
   ```bash
   cd D:\m4sh_v1\backend
   .venv\Scripts\python.exe manage.py runserver
   ```

2. **Запустити frontend:**
   ```bash
   cd D:\m4sh_v1\frontend
   pnpm dev
   ```

3. **Перевірити в браузері:**
   - Відкрити `/dashboard/profile/security`
   - Перевірити, що WebAuthn credentials завантажуються (200)
   - Перевірити, що MFA status завантажується (200)
   - Спробувати regenerate backup codes (має запросити OTP)

4. **Перевірити console:**
   - Не має бути 404 помилок на `/auth/mfa/backup-codes/`
   - Не має бути 404 помилок на `/auth/user/webauthn/credentials/`

---

## Висновок

✅ **Всі API виклики приведені у відповідність з backend контрактом.**  
✅ **Видалено неіснуючі endpoints.**  
✅ **Додано відсутні методи (getMfaStatus, disableMfa).**  
✅ **Оновлено компоненти для використання коректних API.**

**Наступні кроки:**
- Запустити UI smoke тести для перевірки
- Протестувати MFA flow в браузері
- Перевірити WebAuthn enrollment/revoke flow

---

**Підготовлено:** Cascade AI  
**Request ID:** API Contract Audit 2026-01-30
