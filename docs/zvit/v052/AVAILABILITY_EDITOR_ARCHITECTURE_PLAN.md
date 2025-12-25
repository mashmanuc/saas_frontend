# Архітектурний план: Редактор доступності v2.0

## Проблеми поточної реалізації

### 1. Проблема збереження (HTTP 500)
- POST `/api/booking/availability/bulk/` повертає 500
- Неділя не зберігається коректно
- Відсутня обробка помилок на фронтенді

### 2. Проблема UX - заблоковані слоти
- Існуючі слоти показуються як "заброньовані" і не редагуються
- Користувач не може змінити вже створені слоти
- Відсутня логіка керування існуючими слотами

## Архітектурні принципи

### 1. Розділення відповідальності
- **Availability Template** - шаблонний розклад (TutorAvailability)
- **Generated Slots** - згенеровані слоти (TutorAvailabilitySlot) 
- **Editor Logic** - логіка редагування шаблону
- **Conflict Resolution** - вирішення конфліктів

### 2. Стратегія редагування
- Користувач редагує **шаблон доступності**, а не індивідуальні слоти
- Зміни в шаблоні генерують нові слоти
- Існуючі слоти можна перегенерувати або видалити

## Детальний план реалізації

### Фаза 0: Research & Spike (ПЕРЕД Фазою 1)

#### 0.1 Діагностика поточної проблеми
```bash
# Аналіз HTTP 500
- Зібрати логи бекенду для POST /api/booking/availability/bulk/
- Stack trace аналіз
- Перевірити валідацію даних
- Тестувати з різними вхідними даними

# Бенчмарк продуктивності
- Час генерації слотів (поточний)
- Кількість слотів на користувача
- Memory usage при генерації
- DB query performance
```

#### 0.2 Аудит існуючих даних
```sql
-- Аналіз даних користувачів
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN availability_template IS NOT NULL THEN 1 END) as users_with_template,
  AVG(slot_count) as avg_slots_per_user,
  MAX(slot_count) as max_slots_per_user
FROM tutor_availability_stats;

-- Патерни використання
SELECT 
  day_of_week,
  COUNT(*) as frequency,
  AVG(window_count) as avg_windows
FROM tutor_availability_windows 
GROUP BY day_of_week;

-- КРИТИЧНО: Аналіз використання неділі
SELECT 
  COUNT(DISTINCT tutor_id) as sunday_users,
  COUNT(*) as sunday_slots,
  COUNT(CASE WHEN day_of_week = 0 THEN 1 END) as day_0_format,
  COUNT(CASE WHEN day_of_week = 7 THEN 1 END) as day_7_format
FROM tutor_availability_slots 
WHERE day_of_week IN (0, 7);

-- Аналіз конфліктів та перекриттів
SELECT 
  tutor_id,
  date,
  COUNT(*) as overlapping_slots
FROM tutor_availability_slots
GROUP BY tutor_id, date
HAVING COUNT(*) > 1;
```

#### 0.3 Технічний spike
```python
# Тестування генерації слотів
- Генерація 1000+ слотів за раз
- Lazy loading підходи
- Window-based generation (2 тижні)
- Async generation з Celery

# Прототипування conflict resolution
- Алгоритми детекції конфліктів
- Performance з великими даними
- UI прототипи для conflict resolution
```

### Фаза 1: Виправлення бекенду

#### 1.1 Діагностика HTTP 500
```python
# Перевірити логи бекенду
# Додати детальне логування в AvailabilityBulkView
# Валідація вхідних даних
# Обробка виняткових ситуацій
```

#### 1.2 Виправлення неділі (dayValue=0)
```python
# Перевірити конвертацію днів в WeeklyScheduleSerializer
# day 0 (Sunday) -> day 7 для бекенд сумісності
# Тестування всіх днів тижня
```

#### 1.3 Покращення обробки помилок
```python
# Детальні відповіді про помилки
# Валідація формату часу
# Перевірка кількості вікон (max 50)
```

### Фаза 2: Редизайн UX редактора

#### 2.1 Редагування існуючих слотів - КЛЮЧОВА ФУНКЦІЯ
```
Проблема: Користувач не може редагувати існуючі слоти
Рішення: Додати можливість редагування згенерованих слотів

Типи редагування:
1. **Slot Editing** - зміна часу конкретного слота
2. **Batch Editing** - масове редагування слотів
3. **Template Override** - тимчасове перевизначення шаблону

UI Flow для редагування слота:
- Клік на існуючий слот → режим редагування
- Показати доступні варіанти зміни часу
- Валідація конфліктів з іншими слотами
- Збереження з перегенерацією сусідніх слотів

Backend API для редагування:
PUT /booking/availability/slots/{id}/ - оновити конкретний слот
POST /booking/availability/slots/batch/ - масове оновлення
DELETE /booking/availability/slots/{id}/ - видалення слота

Конфлікти при редагуванні:
- Перевірка перекриттів з іншими слотами
- Перевірка конфліктів з заброньованими уроками
- Пропозиції автоматичного вирішення
```

#### 2.2 Стратегія конфліктів
```
Типи конфліктів:
1. Template vs Template - перекриття в шаблоні
2. Template vs Booked - шаблон перекриває заброньовані слоти
3. Slot vs Slot - перекриття згенерованих слотів

Рішення:
1. **Preview Mode** - показати зміни перед збереженням
2. **Smart Conflicts** - блокувати тільки критичні конфлікти
3. **Force Override** - явне підтвердження для перезапису
4. **Gradual Resolution** - пропозиції автоматичного вирішення

UI Flow:
- Show preview of changes
- Highlight conflicts with severity levels
- Offer options: "Fix conflicts", "Force override", "Cancel"
- Log all override decisions for audit
```

#### 2.3 Технічний борг: Неділя (dayValue=0) - КРИТИЧНА МИГРАЦІЯ
```
Проблема: Frontend використовує day 0 (Sunday), Backend очікує day 7
Поточний workaround: Конвертація 0 -> 7 в WeeklyScheduleSerializer

Технічний борг:
- НЕ фундаментальна проблема бекенду, а inconsistency в дата моделі
- Потрібно уніфікувати представлення днів тижня
- Рекомендується міграція на ISO 8601 (1=Monday, 7=Sunday) скрізь

План міграції (КРИТИЧНИЙ):
1. Фаза 1: Додати підтримку обох форматів (backward compatibility)
2. Фаза 2: Міграція frontend на day 7 для Sunday
3. Фаза 3: Видалення старого формату day 0

Зміни, які потрібно зробити:
- Frontend: days array (value: 7 для неділі)
- Frontend: getBlockedSlotsForDay логіка
- Frontend: timeToMinutes та date handling
- Backend: WeeklyScheduleSerializer валідація
- Backend: Availability service логіка
- Тести: всі unit та integration тести
- Документація: оновити API контракти

Ризик: Прорив зміни в усіх компонентах системи
```

#### 2.4 Візуальна індикація
```
Зелене: Доступний час в шаблоні
Жовте: Конфлікт з існуючими слотами
Червоне: Перекриття в шаблоні
Сіре: Заброньовані слоти (тільки для перегляду)
```

#### 2.5 Спрощення UX - поетапний підхід
```
Фаза 1: "Smart Edit" + Slot Editing
- Редагування шаблону з попередженнями про конфлікти
- Редагування існуючих слотів (клік → зміна часу)
- Автоматичне вирішення простих конфліктів
- Manual override для складних випадків

Фаза 2: "Advanced Mode" (за фідбеком)
- Масове редагування слотів
- Template override для тимчасових змін
- Детальна аналітика та звіти

Переваги поетапного підходу:
- Менший ризик перевантаження користувача
- Можливість зібрати реальний фідбек
- Простіша MVP реалізація
- Ключова функція (редагування слотів) доступна з Фази 1
```

### Фаза 3: Технічна реалізація

#### 3.1 Backend API
```python
# Нові ендпоінти для редагування слотів
PUT /booking/availability/slots/{id}/ - оновити конкретний слот
POST /booking/availability/slots/batch/ - масове оновлення
DELETE /booking/availability/slots/{id}/ - видалення слота
GET /booking/availability/slots/conflicts/ - перевірка конфліктів слотів

# Існуючі ендпоінти
GET /booking/availability/template/ - отримати шаблон
PUT /booking/availability/template/ - оновити шаблон
GET /booking/availability/slots/ - отримати слоти
POST /booking/availability/regenerate/ - перегенерувати слоти

# Покращення існуючих
POST /booking/availability/bulk/ - детальна валідація
GET /booking/availability/conflicts/ - перевірка конфліктів
```

#### 3.2 Frontend Components
```vue
<!-- AvailabilityEditor.vue - основний компонент -->
<template>
  <div class="availability-editor">
    <!-- Template Editor -->
    <TemplateEditor 
      :template="template" 
      :conflicts="templateConflicts"
      @save="saveTemplate" />
    
    <!-- Slots Editor -->
    <SlotsEditor 
      :slots="slots"
      :conflicts="slotConflicts"
      @edit-slot="editSlot"
      @delete-slot="deleteSlot"
      @batch-edit="batchEditSlots" />
  </div>
</template>

<!-- SlotEditor.vue - редагування конкретного слота -->
<template>
  <div class="slot-editor" v-if="selectedSlot">
    <TimeRangeInput 
      :start="selectedSlot.start"
      :end="selectedSlot.end"
      @update:start="updateSlotTime('start', $event)"
      @update:end="updateSlotTime('end', $event)" />
    
    <ConflictWarning 
      v-if="slotConflicts.length > 0"
      :conflicts="slotConflicts"
      @resolve="resolveConflicts" />
    
    <div class="actions">
      <button @click="saveSlot">Зберегти</button>
      <button @click="cancel">Скасувати</button>
    </div>
  </div>
</template>
```

#### 3.3 Логіка редагування слотів
```typescript
// Slot editing logic
interface Slot {
  id: string
  start: string
  end: string
  date: string
  status: 'available' | 'booked' | 'blocked'
  source: 'template' | 'manual' | 'override' // КРИТИЧНО: джерело слота
  templateId?: string // якщо source === 'template'
  overrideReason?: string // причина override
}

// Стратегія редагування слота
enum SlotEditStrategy {
  OVERRIDE = 'override',        // Слот відокремлюється від шаблону
  TEMPLATE_UPDATE = 'template_update', // Змінює шаблон і регенерує всі слоти
  USER_CHOICE = 'user_choice'   // Користувач обирає сам
}

class SlotEditor {
  // Редагування конкретного слота
  async editSlot(
    slotId: string, 
    newStart: string, 
    newEnd: string,
    strategy: SlotEditStrategy = SlotEditStrategy.USER_CHOICE
  ): Promise<Slot> {
    const slot = await this.getSlot(slotId)
    
    // Якщо слот згенеровано з шаблону, запитати стратегію
    if (slot.source === 'template' && strategy === SlotEditStrategy.USER_CHOICE) {
      const userChoice = await this.askUserStrategy(slot)
      strategy = userChoice
    }
    
    // 1. Перевірка конфліктів
    const conflicts = await this.detectSlotConflicts(slotId, newStart, newEnd)
    
    // 2. Валідація
    if (conflicts.length > 0) {
      throw new SlotConflictError(conflicts)
    }
    
    // 3. Застосування стратегії
    if (strategy === SlotEditStrategy.OVERRIDE) {
      // Відокремити слот від шаблону
      return await this.overrideSlot(slotId, newStart, newEnd)
    } else if (strategy === SlotEditStrategy.TEMPLATE_UPDATE) {
      // Оновити шаблон і регенерувати
      return await this.updateTemplateAndRegenerate(slot, newStart, newEnd)
    }
    
    // 4. Оновлення слота
    return await this.updateSlot(slotId, { start: newStart, end: newEnd })
  }
  
  // Override слота (відокремлення від шаблону)
  private async overrideSlot(
    slotId: string, 
    newStart: string, 
    newEnd: string
  ): Promise<Slot> {
    const slot = await this.getSlot(slotId)
    
    return await this.updateSlot(slotId, {
      start: newStart,
      end: newEnd,
      source: 'override',
      overrideReason: `Manual edit at ${new Date().toISOString()}`,
      templateId: slot.templateId // Зберігаємо зв'язок з шаблоном
    })
  }
  
  // Оновлення шаблону та регенерація
  private async updateTemplateAndRegenerate(
    slot: Slot,
    newStart: string,
    newEnd: string
  ): Promise<Slot> {
    if (!slot.templateId) {
      throw new Error('Slot has no template association')
    }
    
    // 1. Оновити шаблон
    await this.updateTemplate(slot.templateId, {
      start: newStart,
      end: newEnd
    })
    
    // 2. Регенерувати всі слоти з цього шаблону
    await this.regenerateSlotsFromTemplate(slot.templateId)
    
    // 3. Повернути оновлений слот
    return await this.getSlot(slotId)
  }
  
  // Масове редагування
  async batchEditSlots(updates: SlotUpdate[]): Promise<Slot[]> {
    const results = []
    
    for (const update of updates) {
      try {
        const result = await this.editSlot(
          update.id, 
          update.start, 
          update.end,
          update.strategy || SlotEditStrategy.OVERRIDE
        )
        results.push(result)
      } catch (error) {
        // Логування помилок, продовження з іншими слотами
        console.error(`Failed to edit slot ${update.id}:`, error)
      }
    }
    
    return results
  }
  
  // Перевірка конфліктів слота
  private async detectSlotConflicts(
    slotId: string, 
    newStart: string, 
    newEnd: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = []
    
    // Перевірка перекриттів з іншими слотами
    const overlappingSlots = await this.findOverlappingSlots(newStart, newEnd)
    conflicts.push(...overlappingSlots.map(slot => ({
      type: 'slot_overlap',
      severity: 'error',
      message: `Перекриття з слотом ${slot.start}-${slot.end}`,
      slotId: slot.id
    })))
    
    // Перевірка конфліктів з заброньованими уроками
    const bookedLessons = await this.findBookedLessons(newStart, newEnd)
    conflicts.push(...bookedLessons.map(lesson => ({
      type: 'booked_overlap',
      severity: 'warning',
      message: `Час перекриває урок з ${lesson.studentName}`,
      lessonId: lesson.id
    })))
    
    return conflicts
  }
  
  // UI діалог для вибору стратегії
  private async askUserStrategy(slot: Slot): Promise<SlotEditStrategy> {
    // Показати діалог користувачу
    const choice = await showDialog({
      title: 'Як редагувати цей слот?',
      message: 'Цей слот згенеровано з шаблону. Оберіть дію:',
      options: [
        {
          value: SlotEditStrategy.OVERRIDE,
          label: 'Змінити тільки цей слот',
          description: 'Слот буде відокремлено від шаблону'
        },
        {
          value: SlotEditStrategy.TEMPLATE_UPDATE,
          label: 'Оновити шаблон',
          description: 'Всі слоти з цього шаблону будуть регенеровані'
        }
      ]
    })
    
    return choice
  }
}
```

### Фаза 4: Покращення UX

#### 4.1 Інтерактивний календар
- Візуальний календар замість списку днів
- Перетягування часових інтервалів
- Масові операції (копіювання тижня)

#### 4.2 Розумні підказки
- "Цей час перекриває 3 заброньовані уроки"
- "Рекомендований час на основі історії"
- "Популярні часи для студентів"

#### 4.3 Undo/Redo
- Історія змін шаблону
- Можливість відкатити зміни
- Автозбереження чернеток

### Фаза 5: Тестування та валідація

#### 5.1 Unit тести
```python
# Тести конфліктів
def test_template_conflict_detection()
def test_booked_conflict_detection()
def test_sunday_handling()

# Тести API
def test_availability_template_crud()
def test_slot_generation()
def test_conflict_resolution()
```

#### 5.2 E2E тести
```typescript
// Тести користувацьких сценаріїв
test('user edits weekly template')
test('system prevents conflicts')
test('user manages individual slots')
test('sunday availability works')

#### 4.3 Продуктивність та масштабування
```
Поточні проблеми:
- Генерація всіх слотів за раз може бути повільною
- 1000+ слотів на 3 місяці = potential bottleneck

Рішення:
1. **Window-based Generation** - генерувати тільки 2-4 тижні вперед
2. **Lazy Loading** - генерувати при перегляді календаря
3. **Async Generation** - фонова генерація з Celery
4. **Smart Caching** - кешування згенерованих слотів

Performance targets:
- <2s для генерації 2 тижнів слотів
- <500ms для lazy loading одного тижня
- <100ms для conflict detection
```
### Пріоритети реалізації

### P0 (Критично) - Міграція Sunday day 0→7
1. **Міграція днів тижня** - змінити 0 на 7 для неділі скрізь
2. Виправити HTTP 500 на бекенді
3. Базове збереження шаблону

### P1 (Високий) - Редагування слотів
1. **Редагування існуючих слотів** - клік → зміна часу
2. Детекція конфліктів для слотів
3. Візуальна індикація редагованих слотів

### P2 (Середній)
1. Масове редагування слотів
2. Undo/Redo для змін слотів
3. Інтерактивний календар

### P3 (Низький)
1. Розумні підказки
2. Template override
3. Аналітика популярних часів

## Ризики та мітигації

### Ризик 1: Продуктивність генерації слотів
- Мітигація: Асинхронна генерація, кешування

### Ризик 2: Складність UX
- Мітигація: Поетапне впровадження, юзабіліті тести

### Ризик 3: Сумісність з існуючими даними
- Мітигація: Міграція даних, backward compatibility

## Вимоги до успіху

1. **Надійність** - 99.9% uptime, <1s response time
2. **Usability** - <3 кліків для зміни розкладу
3. **Консистентність** - жодних дублікатів слотів
4. **Зрозумілість** - зрозумілі повідомлення про помилки
5. **Гнучкість** - підтримка різних сценаріїв використання

## Наступні кроки

1. Діагностика та виправлення HTTP 500
2. Тестування неділі
3. Реалізація базової детекції конфліктів
4. Покращення UX повідомлень
5. Впровадження режиму управління слотами

Цей план забезпечить надійне, зрозуміле та гнучке рішення для редагування доступності.
