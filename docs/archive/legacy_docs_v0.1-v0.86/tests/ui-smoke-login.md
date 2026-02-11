# Інструкція: запуск UI Smoke тесту `/auth/login`

Цей тест гарантує, що публічна сторінка логіну рендериться без авторизації, а основні елементи форми доступні та працюють. Нижче покроковий сценарій, за яким я отримав GREEN.

## 1. Попередні умови

1. **Backend** не є обовʼязковим, але бажано, щоб API працював на `http://127.0.0.1:8000`, аби сторінка могла коректно звертатись до health/csrf.
2. **Vite dev server** має стартувати на `http://127.0.0.1:5173`.
3. **Не ставити** `PLAYWRIGHT_WEB_SERVER=none`, інакше Playwright не зможе автоматично перевірити вебсервер.
4. Переконайся, що у `playwright.config.ts` є project `ui-smoke` із `testDir: ./tests/ui`.

## 2. Старт Vite

```bash
pnpm dev -- --host 127.0.0.1 --port 5173
```

- Дочекайся логу `VITE v7.x ready` та URL `http://127.0.0.1:5173/`.
- Не закривай цей процес; тесту потрібен живий дев-сервер.

## 3. Запуск UI Smoke тесту

В окремому терміналі:

```bash
pnpm test:e2e --project=ui-smoke
```

Playwright автоматично використає проект `ui-smoke` і пройде тест `tests/ui/auth-login.spec.ts`.

### Що робить тест
1. Очищує cookies / localStorage.
2. Переходить на `http://127.0.0.1:5173/auth/login` з `waitUntil: 'networkidle'`.
3. Перевіряє URL, видимість `data-testid="login-email-input"`, `login-password-input`, `login-submit-button`.
4. Заповнює інпути тестовими значеннями та перевіряє кнопку.

## 4. Типові помилки та фікси

| Симптом | Причина | Рішення |
|---------|---------|---------|
| `net::ERR_CONNECTION_REFUSED` | Не запущено dev server | Перевір, що крутиться `pnpm dev` та порт 5173 вільний. |
| Playwright намагається виконати `global-setup` | Запущений не той проект | Використовуй `--project=ui-smoke` (він без globalSetup). |
| Тест не бачить елементи форми | Відкрилась інша сторінка / редірект | Переконайся, що `/auth` роут має `meta.requiresAuth = false`, а guard пропускає public routes. |

## 5. Як я подолав помилку "Tutor login response missing access token or user data"

Ця помилка зʼявляється під час `global-setup`, коли бекенд повертає `"access": ""` та `"mfa_required": true` для тестового користувача `m3@gmail.com`. Playwright очікує повноцінний токен, але через увімкнену MFA бекенд блокує видачу токена й вимагає окремого MFA-виклику, якого у global-setup нема. Алгоритм, який спрацював:

1. **Перевірив, що бекенд взагалі відповідає.**
   ```powershell
   cd D:\m4sh_v1\backend
   .venv\Scripts\python.exe manage.py shell
   ```

2. **Скинув MFA для тестового тьютора.** (У нас немає окремої моделі `MFADevice`, тому достатньо вимкнути прапор в extras.)
   ```python
   from apps.users.models import User
   tutor = User.objects.get(email='m3@gmail.com')
   tutor.mfa_secret = ''
   tutor.mfa_enabled = False if hasattr(tutor, 'mfa_enabled') else False
   tutor.save(update_fields=['mfa_secret'])
   ```
   > Якщо використовується новий MFA-модуль, треба видалити всі записи у відповідній таблиці (наприклад, `apps.mfa.models.MFADevice.objects.filter(user=tutor).delete()`). Головна мета — щоб `has_mfa_enabled()` повертав `False`.

3. **Перегенерував auth state.** Видалив старі storage-файли, щоб global-setup залогінився з нуля:
   ```powershell
   Remove-Item tests\e2e\.auth\*.json -ErrorAction SilentlyContinue
   ```

4. **Повторив запуск full-e2e** (або хоча б `global-setup`). Тепер бекенд повернув `access` токен без MFA, і Playwright пройшов до кінця. Якщо треба лише smoke-тест, цей крок можна пропустити.

5. **Додатково**: у разі, якщо MFA знову вмикається (наприклад, автоматичний скрипт), зафіксувати правку в seed-скрипті `e2e_seed_staff`/`e2e_seed_calendar`, аби тестовим користувачам завжди очищували `mfa_secret`.

Після цього помилка зникла, `global-setup` завершується, а smoke-тести можна запускати без перешкод.

## 6. Команда для повного циклу (з паузою на старт dev server)

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','cd D:\m4sh_v1\frontend; pnpm dev -- --host 127.0.0.1 --port 5173'
Start-Sleep -Seconds 10
pnpm test:e2e --project=ui-smoke
```

> 10 секунд достатньо, щоб Vite прогрілося перед тестом. За потреби збільш час очікування.

## 7. Очікуваний результат

```
[ui-smoke] ✓ Auth Login Basic Render — 1 passed (≈4s)
```

Якщо тест зелений, значить сторінка логіну доступна без авторизації, а форма працює.
