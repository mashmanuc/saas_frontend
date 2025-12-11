# Pinia Stores Consistency Report — v0.12.0

## Огляд
Аудит усіх Pinia stores на предмет дублікатів, витоків памʼяті та архітектурних проблем.

---

## 1. relationsStore

### Поточний стан
- **Файл**: `src/stores/relationsStore.js`
- **Розмір**: 262 рядки
- **Залежності**: `relationsApi`, `notify`, `i18n`

### Проблеми
| Проблема | Серйозність | Статус |
|----------|-------------|--------|
| Дублювання логіки translate() | Low | 🔶 Рекомендовано винести |
| Немає dispose() методу | Medium | ✅ Не потрібен (немає timers/subscriptions) |
| Подвійний fetch після accept/decline | Low | ✅ Очікувана поведінка |

### Рекомендації
- Винести `translate()` helper у `src/utils/i18n.js`

---

## 2. lessonsStore (через modules)

### Поточний стан
- **Файл**: `src/modules/lessons/store/lessonsStore.js` (якщо існує) або inline
- **API**: `src/api/lessons.js`

### Проблеми
| Проблема | Серйозність | Статус |
|----------|-------------|--------|
| Немає централізованого store | Medium | 🔶 Рекомендовано створити |
| API не підтримує cursor pagination | Low | 🔶 Backend залежність |

### Рекомендації
- Створити `src/stores/lessonsStore.js` з cursor pagination
- Додати getters для фільтрації за статусом

---

## 3. chatStore

### Поточний стан
- **Файл**: `src/stores/chatStore.js`
- **Розмір**: 388 рядків
- **Залежності**: `chatApi`, `realtimeService`, `notify`, `authStore`

### Проблеми
| Проблема | Серйозність | Статус |
|----------|-------------|--------|
| Великий файл (388 рядків) | Low | 🔶 Можна розбити |
| Бізнес-логіка в store | Medium | 🔶 Винести в service |
| Timers очищаються в dispose() | - | ✅ OK |
| WS subscription cleanup | - | ✅ OK |

### Рекомендації
- Винести `normalizeMessage()` у `src/services/chat/messageNormalizer.js`
- Винести typing logic у `src/services/chat/typingService.js`

---

## 4. notificationsStore

### Поточний стан
- **Файл**: `src/stores/notificationsStore.js`
- **Розмір**: 277 рядків
- **Залежності**: `notificationsApi`, `realtimeService`, `notify`, `authStore`

### Проблеми
| Проблема | Серйозність | Статус |
|----------|-------------|--------|
| Debug events накопичуються | Low | ✅ Обмежено MAX_DEBUG_EVENTS |
| mockOffline для dev | - | ✅ OK |
| Auth subscription cleanup | - | ✅ OK |

### Рекомендації
- Видалити debug функціонал у production build

---

## 5. presenceStore

### Поточний стан
- **Файл**: `src/stores/presenceStore.js`
- **Розмір**: 123 рядки
- **Залежності**: `presenceApi`, `realtimeService`, `notify`

### Проблеми
| Проблема | Серйозність | Статус |
|----------|-------------|--------|
| Timer не очищається при logout | Medium | ✅ Виправлено в dispose() |
| Subscription не відписується | Medium | 🔶 Потрібно додати cleanup |

### Рекомендації
```js
// Додати в presenceStore
subscribeRealtime() {
  if (this.subscription) {
    this.subscription()
  }
  this.subscription = realtimeService.subscribe('presence', ...)
}

dispose() {
  // ...existing code...
  if (this.subscription) {
    this.subscription()
    this.subscription = null
  }
}
```

---

## 6. boardStore

### Поточний стан
- **Файл**: `src/stores/boardStore.js`
- **Розмір**: 301 рядок
- **Залежності**: `boardApi`, `realtimeService`, `notify`, `authStore`

### Проблеми
| Проблема | Серйозність | Статус |
|----------|-------------|--------|
| Cursor cleanup timer | - | ✅ OK |
| Autosave timer | - | ✅ OK |
| WS subscription | - | ✅ OK |

### Рекомендації
- Додати throttle для `sendCursor()` (50ms)

---

## 7. Інші stores

### authStore
- **Файл**: `src/modules/auth/store/authStore.js`
- **Статус**: ✅ OK

### loaderStore
- **Файл**: `src/stores/loaderStore.js`
- **Статус**: ✅ OK (простий counter)

### settingsStore
- **Файл**: `src/stores/settingsStore.js`
- **Статус**: ✅ OK

### themeStore
- **Файл**: `src/stores/themeStore.js`
- **Статус**: ✅ OK

### notifyStore
- **Файл**: `src/stores/notifyStore.js`
- **Статус**: ✅ OK

### realtimeStore
- **Файл**: `src/stores/realtimeStore.js`
- **Статус**: 🔶 Перевірити чи використовується

---

## Загальні рекомендації

### 1. Структура services
```
src/services/
├── chat/
│   ├── messageNormalizer.js
│   └── typingService.js
├── realtime/
│   ├── index.js (existing)
│   └── reconnect.js (new)
└── errors/
    └── errorMap.js (new)
```

### 2. Store naming convention
- Використовувати `use{Name}Store` для всіх stores
- Експортувати як named export

### 3. Cleanup pattern
```js
// Кожен store з timers/subscriptions повинен мати:
dispose() {
  // Clear timers
  if (this.timer) {
    clearTimeout(this.timer)
    this.timer = null
  }
  // Unsubscribe
  if (this.subscription) {
    this.subscription()
    this.subscription = null
  }
  // Reset state
  this.$reset()
}
```

---

## Підсумок

| Store | Timers | Subscriptions | Dispose | Status |
|-------|--------|---------------|---------|--------|
| relationsStore | ❌ | ❌ | N/A | ✅ |
| chatStore | ✅ | ✅ | ✅ | ✅ |
| notificationsStore | ✅ | ✅ | ✅ | ✅ |
| presenceStore | ✅ | ✅ | 🔶 | Needs fix |
| boardStore | ✅ | ✅ | ✅ | ✅ |
| authStore | ❌ | ❌ | N/A | ✅ |
| loaderStore | ❌ | ❌ | N/A | ✅ |
| settingsStore | ❌ | ❌ | N/A | ✅ |
| themeStore | ❌ | ❌ | N/A | ✅ |
| notifyStore | ❌ | ❌ | N/A | ✅ |

---

## Дії

### Виконано в v0.12
- [x] Аудит усіх stores
- [x] Документація проблем
- [x] Створено errorMap.js
- [x] Створено reconnect.js
- [x] Додано throttle utilities

### Рекомендовано для v0.13
- [ ] Винести бізнес-логіку chat у services
- [ ] Виправити presenceStore subscription cleanup
- [ ] Створити централізований lessonsStore
- [ ] Видалити debug код у production
