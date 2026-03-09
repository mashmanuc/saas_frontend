# SESSION DEATH AUDIT — Повний атомарний аналіз

**Дата:** 2026-02-28
**Контекст:** Сесії репетитора помирають під час редагування профілю.
**Метод:** Повний trace від browser cookie → frontend apiClient → backend JWT → forceLogout.

---

## 1. Архітектура сесій (як ПОВИННО працювати)

```
Browser                    Frontend                   Backend
──────                    ─────────                  ──────────
refresh cookie  ────────→  authApi.refresh()  ────→  V1AuthRefreshView
(httpOnly,                 POST /v1/auth/refresh/    reads COOKIES['refresh']
 path=/api/v1/auth/        ↓                         validates RefreshToken
 refresh/)                 receives: { access }      rotates refresh token
                           stores in localStorage    sets new refresh cookie
                           ↓
access token    ←────────  Bearer header on          JWT validates:
(localStorage)             every API call            - signature + expiry
                                                     - token_version match
                                                     - is_deleted = false
```

### TTL таблиця

| Токен | TTL | Зберігання | Оновлення |
|-------|-----|------------|-----------|
| **Access** | 30 хв | localStorage | Proactive refresh кожні 15 хв |
| **Refresh** | 7 днів | httpOnly cookie, path=`/api/v1/auth/refresh/` | Rotation при кожному refresh |

### Proactive refresh (authStore.startProactiveRefresh)

```
setInterval(15 хв):
  if (!access) return
  if (tab hidden) return     ← НЕ рефрешить у фоновій вкладці
  refreshAccess()

visibilitychange → visible:
  refreshAccess()            ← одразу при поверненні на вкладку
```

---

## 2. Повна карта ВСІХ точок де сесія може загинути

### TRIGGER 1: apiClient response interceptor (401 on any request)

**Файл:** `src/utils/apiClient.js:151-236`

**Ланцюг:**
```
Any API call → 401 → interceptor:
  1. store.access == null? → notify + reject (zombie state)
  2. isRefreshingToken? → queue request
  3. Try refreshAccess():
     a. Success → retry original request
     b. 429 → reject (no logout)
     c. Network error → reject (no logout)  
     d. Other error → forceLogout() → redirect /start
  4. If refresh itself got 401 → forceLogout() → redirect /start
```

**Ризики:**
- **R1.1:** Якщо `refreshAccess()` повертає null (через lockedUntil або !access) → throw → forceLogout
- **R1.2:** Якщо refresh endpoint повертає не-401 помилку (500, timeout) → forceLogout

### TRIGGER 2: authStore._doBootstrap (on page load)

**Файл:** `src/modules/auth/store/authStore.js:71-93`

**Ланцюг:**
```
Page load/refresh → router.beforeEach → bootstrap():
  if (access && !user):
    getCurrentUser() → GET /v1/me
    catch: → forceLogout('session_expired')
```

**Ризики:**
- **R2.1:** GET /v1/me returns 401 (expired access) → apiClient interceptor tries refresh → if refresh fails → forceLogout
- **R2.2:** GET /v1/me returns 500 (server error) → catch → forceLogout (!!!)
  **ЦЕ БАГ:** Тимчасова серверна помилка вбиває сесію назавжди

### TRIGGER 3: authStore.reloadUser

**Файл:** `src/modules/auth/store/authStore.js:297-317`

**Ланцюг:**
```
reloadUser() — called from:
  - router beforeEach (line 920)
  - router marketplace/my-profile beforeEnter (line 382)
  - authStore after login/register

  getCurrentUser() → GET /v1/me
  catch: → forceLogout('session_expired')
```

**Ризики:**
- **R3.1:** Навігація на marketplace/my-profile → reloadUser → 500 → forceLogout
  **ЦЕ БАГ:** Перехід між сторінками може вбити сесію при тимчасовій серверній помилці

### TRIGGER 4: authStore.fetchCurrentUser

**Файл:** `src/modules/auth/store/authStore.js:413-425`

**Ланцюг:**
```
fetchCurrentUser():
  getCurrentUser() → GET /v1/me
  catch: → forceLogout()
```

**Ризики:**
- **R4.1:** Те саме — будь-яка помилка (не лише 401) → forceLogout

### TRIGGER 5: Proactive refresh failure

**Файл:** `src/modules/auth/store/authStore.js:432-448`

**Ланцюг:**
```
setInterval(15 хв):
  refreshAccess() fails:
    429 → skip (OK)
    other → forceLogout()
```

**Ризики:**
- **R5.1:** Тимчасовий network glitch → refreshAccess throws → forceLogout
- **R5.2:** Server restart / 502 / 503 → forceLogout

### TRIGGER 6: Visibility change refresh

**Файл:** `src/modules/auth/store/authStore.js:452-465`

**Ланцюг:**
```
Tab becomes visible:
  refreshAccess() fails:
    429 → skip (OK)
    other → forceLogout()
```

**Ризики:**
- **R6.1:** Повернення на вкладку → refresh → мережева помилка → forceLogout
- **R6.2:** Повернення на вкладку → refresh → 500 → forceLogout

### TRIGGER 7: classroomStore.loadClassrooms

**Файл:** `src/modules/classrooms/store/classroomStore.js:40-47`

**Ланцюг:**
```
loadClassrooms():
  getTutorClassrooms() → 401 → forceLogout (bypasses apiClient interceptor!)
```

**Ризики:**
- **R7.1:** Подвійний forceLogout — apiClient interceptor ВЖЕ обробляє 401, але classroomStore робить свій forceLogout зверху

### TRIGGER 8: initStorageSync (cross-tab)

**Файл:** `src/modules/auth/store/authStore.js:641-659`

**Ланцюг:**
```
window 'storage' event:
  key === 'access' && !newValue → forceLogout('other_tab_logout')
```

**Ризики:**
- **R8.1:** Якщо інша вкладка зробила logout або очистила storage → ця вкладка теж помре

### TRIGGER 9: WebSocket session_revoked

**Файл:** `src/modules/auth/store/authStore.js:769-776`

**Ланцюг:**
```
handleError():
  401 + error === 'session_revoked' → forceLogout()
```

### TRIGGER 10: router.beforeEach → reloadUser race

**Файл:** `src/router/index.js:918-925`

**Ланцюг:**
```
!isAuthenticated && hasAccessToken:
  reloadUser() → GET /v1/me → any error → forceLogout
```

**Ризики:**
- **R10.1:** При навігації (кожен route change!) якщо access є але user null → reloadUser → може вбити сесію

---

## 3. Backend причини 401

### B1: Access token expired (30 хв TTL)
```
JWTAuthentication.authenticate() → token expired → 401
```
**Нормальний сценарій** — має тригернути refresh.

### B2: token_version mismatch
```
M4SHJWTAuthentication.get_user() → token_version ≠ user.token_version → 401
```
**Тригер:** Зміна пароля, адмін-дія, або force invalidation.

### B3: User is_deleted
```
M4SHJWTAuthentication.get_user() → is_deleted = true → 401
```

### B4: Refresh token missing (cookie not sent)
```
V1AuthRefreshView.post() → COOKIES.get('refresh') = None → 401
```
**Ризик:** Cookie path mismatch (ВИПРАВЛЕНО в коміті 80476d3)

### B5: Refresh token invalid/expired
```
V1AuthRefreshView.post() → RefreshToken(token) → exception → 401
```

### B6: Session revoked
```
V1AuthRefreshView.post() → session.revoked_at → 401 'session_revoked'
```

### B7: Refresh token_version mismatch
```
V1AuthRefreshView.post() → token_version ≠ user.token_version → 401
```

### B8: User not found
```
V1AuthRefreshView.post() → User.objects.filter(id=user_id).first() = None → 401
```

---

## 4. Інваріанти (що ЗАВЖДИ повинно бути true)

### I1: forceLogout ТІЛЬКИ при невідновлюваній помилці
```
forceLogout() ДОЗВОЛЕНО тільки коли:
  - refresh token невалідний (бекенд підтвердив)
  - session explicitly revoked
  - user deleted/archived
  - manual logout

forceLogout() ЗАБОРОНЕНО коли:
  - тимчасова серверна помилка (500, 502, 503)
  - мережевий glitch (timeout, CORS, DNS)
  - rate limiting (429)
```

### I2: Будь-яка точка що викликає forceLogout ПОВИННА перевіряти причину
```
catch (error) {
  const status = error?.response?.status
  // forceLogout ТІЛЬКИ при автентифікаційних помилках
  if (status === 401) → forceLogout
  // ВСЕ інше — NOT forceLogout
}
```

### I3: Proactive refresh має бути fault-tolerant
```
Один невдалий refresh НЕ повинен вбивати сесію.
Тільки якщо refresh повернув 401 (token дійсно протух).
```

### I4: apiClient interceptor — єдина точка refresh
```
Ніякий інший код не повинен самостійно обробляти 401.
apiClient interceptor — SSOT для 401 handling.
```

---

## 5. Знайдені порушення інваріантів (БАГИ)

### BUG-1: _doBootstrap — forceLogout при БУДЬ-ЯКІЙ помилці
**Інваріант:** I1, I2
**Файл:** `authStore.js:83-85`
```js
} catch (error) {
  await this.forceLogout('session_expired')  // ← 500 теж вбиває сесію!
}
```
**Фікс:** Перевіряти status. forceLogout тільки при 401.

### BUG-2: reloadUser — forceLogout при БУДЬ-ЯКІЙ помилці
**Інваріант:** I1, I2
**Файл:** `authStore.js:313-315`
```js
} catch (error) {
  await this.forceLogout('session_expired')  // ← 500, timeout теж вбивають
}
```
**Фікс:** Перевіряти status. forceLogout тільки при 401.

### BUG-3: fetchCurrentUser — forceLogout при БУДЬ-ЯКІЙ помилці
**Інваріант:** I1, I2
**Файл:** `authStore.js:421-423`
```js
} catch (error) {
  await this.forceLogout()  // ← будь-яка помилка
}
```
**Фікс:** Перевіряти status.

### BUG-4: Proactive refresh — forceLogout при non-401 помилці
**Інваріант:** I1, I3
**Файл:** `authStore.js:440-447`
```js
} catch (error) {
  const status = error?.response?.status
  if (status === 429) { return }
  await this.forceLogout()  // ← 500, network error теж!
}
```
**Фікс:** forceLogout тільки при 401. Інше — пропускаємо, спробуємо наступного разу.

### BUG-5: Visibility refresh — forceLogout при non-401 помилці
**Інваріант:** I1, I3
**Файл:** `authStore.js:459-463`
```js
} catch (error) {
  const status = error?.response?.status
  if (status !== 429) {
    await this.forceLogout()  // ← 500, network error
  }
}
```
**Фікс:** Те саме — forceLogout тільки при 401.

### BUG-6: classroomStore — подвійний forceLogout
**Інваріант:** I4
**Файл:** `classroomStore.js:42-47`
```js
if (status === 401) {
  await authStore.forceLogout('session_expired')  // ← apiClient вже обробив!
}
```
**Фікс:** Видалити — apiClient interceptor вже обробляє 401.

### BUG-7: refreshAccess — forceLogout при timeout/network в apiClient interceptor
**Інваріант:** I1
**Файл:** `apiClient.js:194-206` — вже частково пофіксено (network check), але:
```js
// Якщо refreshAccess() кидає помилку через refreshError.response.status === 500
// → forceLogout
```
**Стан:** Частково виправлено. Потрібна додаткова перевірка: forceLogout тільки при 401.

---

## 6. Ланцюгові міркування (Chain of Failure)

### Chain A: Тимчасовий 500 → смерть сесії
```
1. Бекенд на секунду повертає 500 (deploy, DB restart, OOM)
2. Proactive refresh → refreshAccess() → POST /auth/refresh/ → 500
3. authStore catch: status !== 429 → forceLogout()
4. Сесія мертва. Юзер втрачає роботу.
```

### Chain B: Навігація → reloadUser → 500 → смерть
```
1. Юзер на /marketplace/my-profile, натискає на іншу сторінку
2. router.beforeEach → !isAuthenticated && hasAccessToken → reloadUser()
3. GET /v1/me → тимчасовий 500
4. reloadUser catch → forceLogout('session_expired')
5. Юзер на /start. Все втрачено.
```

### Chain C: Bootstrap після F5 → 500 → смерть
```
1. Юзер натискає F5 (refresh сторінки)
2. bootstrap() → _doBootstrap() → getCurrentUser()
3. GET /v1/me → 500 (server just restarted)
4. catch → forceLogout('session_expired')
5. Access token видалено. Юзер мусить логінитись заново.
```

### Chain D: Повернення на вкладку → смерть
```
1. Юзер переключився на іншу вкладку на 5 хв
2. Повертається → visibilitychange → visible
3. refreshAccess() → POST /auth/refresh/ → 502 (nginx restart)
4. catch: status !== 429 → forceLogout()
5. Сесія мертва.
```

---

## 7. План фіксу

### Принцип: forceLogout ТІЛЬКИ при 401 від бекенда

Єдина функція-guard:

```js
function isAuthError(error) {
  const status = error?.response?.status
  return status === 401
}
```

### FIX-1: _doBootstrap
```js
catch (error) {
  if (isAuthError(error)) {
    await this.forceLogout('session_expired')
  }
  // else: залишаємо юзера без user, router guard сам redirect-не
}
```

### FIX-2: reloadUser  
```js
catch (error) {
  if (isAuthError(error)) {
    await this.forceLogout('session_expired')
  }
  throw error
}
```

### FIX-3: fetchCurrentUser
```js
catch (error) {
  if (isAuthError(error)) {
    await this.forceLogout()
  }
  throw error
}
```

### FIX-4: Proactive refresh (interval)
```js
catch (error) {
  const status = error?.response?.status
  if (status === 429) return  // rate limit — skip
  if (status === 401) {
    await this.forceLogout()  // token truly dead
    return
  }
  // 500, network — skip, try next interval
}
```

### FIX-5: Visibility refresh
```js
catch (error) {
  const status = error?.response?.status
  if (status === 401) {
    await this.forceLogout()
  }
  // else: skip — will retry on next visibility change or interval
}
```

### FIX-6: classroomStore — remove duplicate 401 handling
Remove manual forceLogout. apiClient interceptor handles it.

### FIX-7: apiClient interceptor — forceLogout тільки при 401 від refresh
```js
catch (refreshError) {
  const refreshStatus = refreshError?.response?.status
  if (refreshStatus === 429) return reject(error)
  if (!navigator.onLine || !refreshError?.response) return reject(refreshError)
  if (refreshStatus === 401) {
    // Token truly dead — logout
    await store.forceLogout('session_expired')
    notifySessionExpired()
    router.push('/start')
  }
  // 500 from refresh endpoint — don't kill session
  return reject(refreshError)
}
```

---

## 8. Верифікація після фіксу

- [ ] `npx vite build --mode development`
- [ ] `npx vitest run` (relevant tests)
- [ ] Manual: відкрити профіль → зімітувати 500 на /v1/me → сесія живе
- [ ] Manual: відкрити профіль → зімітувати 401 на refresh → сесія помирає (правильно)
- [ ] Manual: переключити вкладку → повернутись → сесія живе
- [ ] Manual: F5 → сесія живе (якщо refresh token валідний)
