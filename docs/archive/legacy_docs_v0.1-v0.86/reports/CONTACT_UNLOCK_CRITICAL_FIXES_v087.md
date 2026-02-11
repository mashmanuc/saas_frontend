# Contact Unlock Critical Fixes v0.87.0

**Дата:** 2026-02-04  
**Статус:** ✅ ВИПРАВЛЕНО (архітектурно чисто)

---

## Проблеми з production

1. ❌ `GET /api/v1/student/relations/ 404` - tutor UI викликав student endpoint
2. ❌ `POST /api/v1/contact-unlock/ 403` - UI відправляв `force_unlock: true`
3. ❌ Перший accept помилка, другий успіх - stale state
4. ❌ Role context leak при зміні користувача

**Root cause:** Frontend не скидав stores при login/role change

---

## Виправлення

### ✅ FIX 1: Видалено force_unlock з UI
**Файл:** `contactAccessStore.js:48`

```javascript
// ❌ БУЛО:
const response = await contactsApi.unlockContacts(inquiryId, true)

// ✅ СТАЛО:
const response = await contactsApi.unlockContacts(inquiryId, false)
```

---

### ✅ FIX 2: Обов'язковий refetch після unlock
**Файл:** `contactAccessStore.js:67-74`

```javascript
// v0.87.0: КРИТИЧНО - refetch relations після unlock
const { useRelationsStore } = await import('./relationsStore')
const relationsStore = useRelationsStore()
await relationsStore.fetchTutorRelations()
```

---

### ✅ FIX 3: Прибрано force параметр
**Файл:** `contactAccessStore.js:71`

```javascript
// ✅ Викликаємо без force (його нема в API контракті)
await relationsStore.fetchTutorRelations()
```

---

### ✅ FIX 4: Детермінований reset stores
**Файл:** `authStore.js:301-318`

**Архітектура:**
- `setAuth()` - sync, встановлює user/access
- `postAuthInit()` - async, reset stores детерміновано
- Порядок: `setAuth` → `postAuthInit` → `ensureCsrfToken` → `reloadUser`

```javascript
// Фаза 1: sync
setAuth({ access, user }) {
  this.user = user
  storage.setUser(this.user)
  // БЕЗ setTimeout, БЕЗ race conditions
}

// Фаза 2: async, детермінована
async postAuthInit() {
  const { useRelationsStore } = await import('../../../stores/relationsStore')
  const relationsStore = useRelationsStore()
  relationsStore.$reset()

  const { useContactAccessStore } = await import('../../../stores/contactAccessStore')
  const contactAccessStore = useContactAccessStore()
  contactAccessStore.$reset()
}
```

**Виклики:**
- `login()` → `setAuth` → `postAuthInit` ✅
- `verifyMfa()` → `setAuth` → `postAuthInit` ✅
- `verifyWebAuthn()` → `setAuth` → `postAuthInit` ✅
- `acceptInvite()` → `setAuth` → `postAuthInit` ✅

---

## Що НЕ зроблено (і чому)

❌ **setTimeout** - race condition за дизайном  
❌ **force параметр** - порушення SSOT (його нема в API)  
❌ **Маскування** - усунуто причину, не симптоми

---

## Тестування

**План:**
1. Новий тютор `tu1@gmail.com`
2. Існуючий студент `s3@gmail.com`
3. Inquiry → Accept → Unlock
4. Перевірити Network:
   - ✅ Тільки `/api/v1/tutor/*` endpoints
   - ❌ Жодних `/api/v1/student/*`
   - ❌ Жодних `force_unlock: true`

**Очікуваний результат:**
- Accept працює з першого разу
- Unlock працює без 403
- Контакти відображаються
- Чат доступний

---

## Архітектурна гарантія

**Детермінований порядок операцій:**
```
login
  ↓
setAuth (sync)
  ↓
postAuthInit (async)
  ↓ reset relations store
  ↓ reset contact access store
  ↓
ensureCsrfToken
  ↓
reloadUser
```

**Без:**
- setTimeout
- race conditions
- недетермінованого порядку
- маскування проблем

✅ **Чистий архітектурний шов**
