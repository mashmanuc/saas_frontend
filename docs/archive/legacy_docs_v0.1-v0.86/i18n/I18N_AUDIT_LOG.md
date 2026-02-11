# I18N AUDIT LOG
**Дата:** 2026-02-09
**Статус:** В процесі автономного виконання

## Поточний стан (pnpm i18n:check --report)

### ❌ КРИТИЧНІ ПРОБЛЕМИ

**1. Missing keys в uk.json (155 ключів)**
- `contacts.ledger.*` (5 ключів: error, loading, balanceAfter, loadMore, endOfList)
- `contacts.balance.*` (4 ключі: ariaLabel, error, label)
- `inquiries.countdown.*` (2 ключі: expiresIn, expired)
- +145 інших ключів

**2. Missing keys в en.json (164 ключі)**
- `contacts.allowance.*` (4 ключі: history, nextRefill, perMonth, title)
- `contacts.balance.*` (6 ключів: addTokens, lowBalance, title, tokens, viewHistory, zeroBalance)
- +154 інших ключів

**3. Extra keys в en.json (109 ключів)**
- `contacts.address`, `contacts.email`
- `contacts.balance.*` (4 ключі: ariaLabel, error, label)
- `contacts.ledger.*` (5 ключів)
- +99 інших ключів

**4. Unused keys (726 ключів)**
- Класифіковані як placeholders/dynamic usage

### 📊 Метрики
- **uk.json:** 3641 ключів
- **Missing в uk:** 155 ⚠️
- **Missing в en:** 164 ⚠️
- **Extra в en:** 109 ⚠️
- **Unused:** 726 (норма для placeholders)

---

## План виправлення

### Фаза 1: Синхронізація uk.json (SSOT)
1. Знайти всі 155 missing ключів у коді
2. Додати їх у uk.json з українськими значеннями
3. Перевірити namespace відповідність (contacts.*, inquiries.*)

### Фаза 2: Синхронізація en.json
1. Додати 164 missing ключі з uk.json
2. Видалити 109 extra ключів (або додати в uk, якщо використовуються)
3. Досягти 100% паритету uk ↔ en

### Фаза 3: Валідація
1. Запустити `pnpm i18n:check --report`
2. Підтвердити 0 missing/extra keys
3. Оновити PLAN.md зі статусом Done

---

## Прогрес виконання

- [ ] Фаза 1: Синхронізація uk.json
- [ ] Фаза 2: Синхронізація en.json
- [ ] Фаза 3: Фінальна валідація
