# E2E Tests Setup Guide

## Передумови

### Backend Configuration

Backend повинен працювати з `E2E_MODE=1` для синхронного виконання Celery tasks.

**Варіант 1: Через змінну оточення**
```powershell
cd D:\m4sh_v1\backend
$env:E2E_MODE='1'
.venv\Scripts\python.exe manage.py runserver
```

**Варіант 2: Через .env файл**
```powershell
cd D:\m4sh_v1\backend
# Додайте E2E_MODE=1 до .env файлу
echo "E2E_MODE=1" >> .env
.venv\Scripts\python.exe manage.py runserver
```

**Перевірка налаштування:**
```powershell
cd D:\m4sh_v1\backend
.venv\Scripts\python.exe manage.py shell -c "from django.conf import settings; print(f'E2E_MODE: {settings.E2E_MODE}'); print(f'CELERY_TASK_ALWAYS_EAGER: {settings.CELERY_TASK_ALWAYS_EAGER}')"
```

Очікуваний вивід:
```
E2E_MODE: True
CELERY_TASK_ALWAYS_EAGER: True
```

## Запуск тестів

### Повний прогон (з seed)
```powershell
cd D:\m4sh_v1\frontend
npm run test:e2e -- --project=calendar-e2e tests/e2e/calendar-suite/createLesson.spec.ts
```

Global setup автоматично:
1. Запустить `e2e_seed_calendar` management command
2. Створить детерміновані дані (tutor, student, relation, slots)
3. Перевірить доступність даних через calendar API
4. Виконає аутентифікацію

### Швидкий прогон (без seed)
Якщо seed вже виконано і дані актуальні:
```powershell
cd D:\m4sh_v1\frontend
$env:E2E_SKIP_SEED='1'
npm run test:e2e -- --project=calendar-e2e tests/e2e/calendar-suite/createLesson.spec.ts
```

### Ручний seed (опціонально)
```powershell
cd D:\m4sh_v1\backend
.venv\Scripts\python.exe manage.py e2e_seed_calendar
```

## Детерміновані дані

Seed створює:
- **Tutor**: `m3@gmail.com` (id=79)
- **Student**: `e2e-student@example.com` (id=90)
- **Relation**: active між tutor та student
- **Accessible slots**: 21 слот на години 10:00-12:00, 14:00-15:00, 16:00-17:00 протягом 7 днів

## Архітектура

### Global Setup (`tests/e2e/global-setup.ts`)
- Виконує seed command через `execSync`
- Перевіряє доступність даних через calendar API (sanity check)
- Виконує аутентифікацію та зберігає auth state

### Test Spec (`tests/e2e/calendar-suite/createLesson.spec.ts`)
- **Не виконує** seed (це робить global-setup)
- **Не використовує** retry loops або DOM маніпуляції
- Працює з детермінованими даними через `data-testid`
- 2 сценарії: happy path + validation

### UI Layer (`src/modules/booking/components/calendar/layers/AccessibleSlotsLayer.vue`)
- Додано `data-slot-hour` атрибут для детермінованого пошуку слотів
- Використовує `data-testid="accessible-slot"` для E2E тестів

## Troubleshooting

### "No accessible slots found in calendar API"
**Причина**: Backend не працює з `E2E_MODE=1`

**Рішення**: Перезапустіть backend з `E2E_MODE=1` (див. вище)

### "E2E seed command failed"
**Причина**: Віртуальне середовище не знайдено або Django не налаштовано

**Рішення**: 
```powershell
cd D:\m4sh_v1\backend
# Перевірте наявність .venv
Test-Path .venv\Scripts\python.exe
# Якщо False, створіть venv
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

### Тести падають на "accessible-slot not visible"
**Причина**: Seed виконано, але backend не повертає слоти через API

**Рішення**: Перевірте, що backend працює з `E2E_MODE=1` та перезапустіть тести

## CI/CD Integration

Для CI pipeline додайте:
```yaml
- name: Setup Backend E2E Mode
  run: |
    cd backend
    echo "E2E_MODE=1" >> .env
    python manage.py e2e_seed_calendar
    python manage.py runserver &
    
- name: Run E2E Tests
  run: |
    cd frontend
    npm run test:e2e -- --project=calendar-e2e
```
