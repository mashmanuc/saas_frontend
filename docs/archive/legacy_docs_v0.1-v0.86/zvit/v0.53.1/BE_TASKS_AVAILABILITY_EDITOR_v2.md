# Backend Tasks: Availability Editor v2.0

## Контекст для Backend-команди

«Ти — член команди M4SH, що реалізує Availability Editor v2.0 згідно з AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md. Працюєш без пауз, але не "всліпу": тримаєш повний контекст архітектури (Availability Template → SlotService → TutorAvailabilitySlot → Calendar API).

Кожен крок — частина фундаменту, не короткочасна латка.
Перед змінами перечитай відповідні секції BE-плану (модель TutorAvailabilitySlot, Celery таски, rate limiting, audit trail, Prometheus метрики).
Реалізуй код так, щоб він був розширюваним: жодних "тимчасово", повага до Platform Expansion Law.
Після кожної функціональної зміни: перевір валідацію, обробку помилок, телеметрію та покрий unit/integration тестами з прикладів у ТЗ.
Документацію (docstrings, README, API contract) тримай синхронною з кодом.
Усі рішення аргументуй у коментарях/commit messages з посиланням на TЗ.
Пиши код так, ніби твоя репутація архітектора залежить від кожного рядка.»

---

## Фаза 0: Research & Diagnostics

### Task 0.1: Діагностика HTTP 500 Error

**Пріоритет:** P0 (Критичний)  
**Estimated:** 4 години  
**Owner:** Backend Lead

#### Опис проблеми
POST `/api/booking/availability/bulk/` повертає HTTP 500. Неділя не зберігається коректно.

#### Кроки виконання

1. **Збір логів та stack trace**
```bash
# Перевірити логи Django
tail -f /var/log/m4sh/django.log | grep "availability/bulk"

# Перевірити Sentry для stack traces
# Фільтр: endpoint="/api/booking/availability/bulk/" AND status=500
```

2. **Аналіз коду AvailabilityBulkView**
```python
# Файл: backend/apps/booking/api/views.py
# Перевірити:
# - Валідацію вхідних даних
# - Обробку day_of_week (0 vs 7 для неділі)
# - Serializer валідацію
# - Database constraints
```

3. **Тестування з різними вхідними даними**
```python
# Тест кейси:
test_cases = [
    # Неділя як day 0
    {"schedule": {"0": [{"start_time": "10:00", "end_time": "12:00"}]}},
    # Неділя як day 7
    {"schedule": {"7": [{"start_time": "10:00", "end_time": "12:00"}]}},
    # Всі дні тижня
    {"schedule": {str(i): [{"start_time": "10:00", "end_time": "12:00"}] for i in range(1, 8)}},
    # Перекриття в межах дня
    {"schedule": {"1": [
        {"start_time": "10:00", "end_time": "12:00"},
        {"start_time": "11:00", "end_time": "13:00"}
    ]}},
]
```

4. **Виправлення та валідація**
```python
# Додати детальне логування
import logging
logger = logging.getLogger(__name__)

class AvailabilityBulkView(APIView):
    def post(self, request):
        logger.info(f"[AvailabilityBulk] Request data: {request.data}")
        
        try:
            serializer = WeeklyScheduleSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            logger.info(f"[AvailabilityBulk] Validated data: {serializer.validated_data}")
            
            # ... rest of the code
            
        except Exception as e:
            logger.error(f"[AvailabilityBulk] Error: {str(e)}", exc_info=True)
            raise
```

#### Критерії прийняття
- [ ] Stack trace зібрано та проаналізовано
- [ ] Root cause визначено
- [ ] Виправлення реалізовано
- [ ] Всі тест кейси проходять
- [ ] Логування додано
- [ ] Unit тести покривають edge cases

---

### Task 0.2: Аудит даних та міграція неділі

**Пріоритет:** P0 (Критичний)  
**Estimated:** 6 годин  
**Owner:** Backend Engineer

#### SQL Аналіз

```sql
-- 1. Загальна статистика
SELECT 
  COUNT(*) as total_tutors,
  COUNT(CASE WHEN has_availability THEN 1 END) as tutors_with_availability,
  AVG(slot_count) as avg_slots_per_tutor,
  MAX(slot_count) as max_slots_per_tutor
FROM (
  SELECT 
    tutor_id,
    COUNT(*) as slot_count,
    CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END as has_availability
  FROM booking_tutoravailabilityslot
  GROUP BY tutor_id
) as stats;

-- 2. КРИТИЧНО: Аналіз неділі
SELECT 
  COUNT(DISTINCT tutor_id) as sunday_users,
  COUNT(*) as sunday_slots,
  COUNT(CASE WHEN EXTRACT(DOW FROM date) = 0 THEN 1 END) as sunday_date_format,
  COUNT(CASE WHEN day_of_week = 0 THEN 1 END) as day_0_format,
  COUNT(CASE WHEN day_of_week = 7 THEN 1 END) as day_7_format
FROM booking_tutoravailabilityslot 
WHERE EXTRACT(DOW FROM date) = 0 OR day_of_week IN (0, 7);

-- 3. Патерни використання днів тижня
SELECT 
  CASE 
    WHEN day_of_week = 0 THEN 'Sunday (0)'
    WHEN day_of_week = 7 THEN 'Sunday (7)'
    WHEN day_of_week = 1 THEN 'Monday'
    WHEN day_of_week = 2 THEN 'Tuesday'
    WHEN day_of_week = 3 THEN 'Wednesday'
    WHEN day_of_week = 4 THEN 'Thursday'
    WHEN day_of_week = 5 THEN 'Friday'
    WHEN day_of_week = 6 THEN 'Saturday'
  END as day_name,
  COUNT(*) as slot_count,
  COUNT(DISTINCT tutor_id) as tutor_count,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as avg_duration_hours
FROM booking_tutoravailabilityslot
GROUP BY day_of_week
ORDER BY day_of_week;

-- 4. Конфлікти та перекриття
SELECT 
  tutor_id,
  date,
  COUNT(*) as overlapping_slots,
  ARRAY_AGG(start_time ORDER BY start_time) as start_times,
  ARRAY_AGG(end_time ORDER BY start_time) as end_times
FROM booking_tutoravailabilityslot
WHERE status = 'available'
GROUP BY tutor_id, date
HAVING COUNT(*) > 1;

-- 5. Аналіз availability templates
SELECT 
  day_of_week,
  COUNT(*) as template_count,
  COUNT(DISTINCT tutor_id) as tutor_count,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as avg_window_hours
FROM booking_tutoravailability
GROUP BY day_of_week
ORDER BY day_of_week;
```

#### Міграція day 0 → day 7

```python
# Файл: backend/apps/booking/migrations/0XXX_migrate_sunday_to_day_7.py

from django.db import migrations

def migrate_sunday_to_day_7(apps, schema_editor):
    """
    Міграція неділі з day_of_week=0 на day_of_week=7
    для сумісності з ISO 8601 (1=Monday, 7=Sunday)
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 2.3
    """
    TutorAvailability = apps.get_model('booking', 'TutorAvailability')
    TutorAvailabilitySlot = apps.get_model('booking', 'TutorAvailabilitySlot')
    
    # Міграція templates
    sunday_templates = TutorAvailability.objects.filter(day_of_week=0)
    count_templates = sunday_templates.count()
    sunday_templates.update(day_of_week=7)
    
    # Міграція slots
    sunday_slots = TutorAvailabilitySlot.objects.filter(day_of_week=0)
    count_slots = sunday_slots.count()
    sunday_slots.update(day_of_week=7)
    
    print(f"Migrated {count_templates} templates and {count_slots} slots from day 0 to day 7")

def reverse_migration(apps, schema_editor):
    """Rollback: day 7 → day 0"""
    TutorAvailability = apps.get_model('booking', 'TutorAvailability')
    TutorAvailabilitySlot = apps.get_model('booking', 'TutorAvailabilitySlot')
    
    TutorAvailability.objects.filter(day_of_week=7).update(day_of_week=0)
    TutorAvailabilitySlot.objects.filter(day_of_week=7).update(day_of_week=0)

class Migration(migrations.Migration):
    dependencies = [
        ('booking', '0XXX_previous_migration'),
    ]
    
    operations = [
        migrations.RunPython(migrate_sunday_to_day_7, reverse_migration),
    ]
```

#### Критерії прийняття
- [ ] SQL аналіз виконано, результати задокументовано
- [ ] Кількість користувачів з неділею визначено
- [ ] Міграція створено та протестовано на staging
- [ ] Rollback план підготовлено
- [ ] Backup даних створено перед міграцією
- [ ] Міграція виконана на production
- [ ] Валідація після міграції пройшла успішно

---

## Фаза 1: Core Backend Implementation

### Task 1.1: Розширення моделі TutorAvailabilitySlot

**Пріоритет:** P0 (Критичний)  
**Estimated:** 4 години  
**Owner:** Backend Engineer

#### Додати поля для slot source tracking

```python
# Файл: backend/apps/booking/models.py

class TutorAvailabilitySlot(models.Model):
    """
    Згенерований слот доступності тьютора
    
    v2.0 improvements:
    - Added source tracking (template/manual/override)
    - Added template_id for template-generated slots
    - Added override_reason for audit trail
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 3.3
    """
    
    class SlotSource(models.TextChoices):
        TEMPLATE = 'template', 'Generated from template'
        MANUAL = 'manual', 'Manually created'
        OVERRIDE = 'override', 'Template override'
    
    # Existing fields
    tutor = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=20, choices=Status.choices)
    day_of_week = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(7)])
    
    # NEW: Source tracking fields
    source = models.CharField(
        max_length=20,
        choices=SlotSource.choices,
        default=SlotSource.TEMPLATE,
        help_text="Source of this slot (template/manual/override)"
    )
    
    template_id = models.ForeignKey(
        'TutorAvailability',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_slots',
        help_text="Template that generated this slot (if source=template)"
    )
    
    override_reason = models.TextField(
        null=True,
        blank=True,
        help_text="Reason for override (if source=override)"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'booking_tutoravailabilityslot'
        indexes = [
            models.Index(fields=['tutor', 'date']),
            models.Index(fields=['tutor', 'status']),
            models.Index(fields=['source']),  # NEW
            models.Index(fields=['template_id']),  # NEW
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(start_time__lt=models.F('end_time')),
                name='start_before_end'
            ),
            models.CheckConstraint(
                check=models.Q(day_of_week__gte=1) & models.Q(day_of_week__lte=7),
                name='valid_day_of_week'
            ),
        ]
    
    def __str__(self):
        return f"{self.tutor.email} - {self.date} {self.start_time}-{self.end_time} ({self.source})"
```

#### Міграція

```python
# Файл: backend/apps/booking/migrations/0XXX_add_slot_source_tracking.py

from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('booking', '0XXX_migrate_sunday_to_day_7'),
    ]
    
    operations = [
        migrations.AddField(
            model_name='tutoravailabilityslot',
            name='source',
            field=models.CharField(
                choices=[
                    ('template', 'Generated from template'),
                    ('manual', 'Manually created'),
                    ('override', 'Template override')
                ],
                default='template',
                max_length=20,
                help_text='Source of this slot (template/manual/override)'
            ),
        ),
        migrations.AddField(
            model_name='tutoravailabilityslot',
            name='template_id',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='generated_slots',
                to='booking.tutoravailability',
                help_text='Template that generated this slot (if source=template)'
            ),
        ),
        migrations.AddField(
            model_name='tutoravailabilityslot',
            name='override_reason',
            field=models.TextField(
                blank=True,
                null=True,
                help_text='Reason for override (if source=override)'
            ),
        ),
        migrations.AddIndex(
            model_name='tutoravailabilityslot',
            index=models.Index(fields=['source'], name='booking_slot_source_idx'),
        ),
        migrations.AddIndex(
            model_name='tutoravailabilityslot',
            index=models.Index(fields=['template_id'], name='booking_slot_template_idx'),
        ),
    ]
```

#### Критерії прийняття
- [ ] Поля додано до моделі
- [ ] Міграція створено та протестовано
- [ ] Індекси додано для продуктивності
- [ ] Constraints валідовано
- [ ] Документація оновлено

---

### Task 1.2: API для редагування слотів

**Пріоритет:** P1 (Високий)  
**Estimated:** 8 годин  
**Owner:** Backend Engineer

#### Serializers

```python
# Файл: backend/apps/booking/api/serializers.py

class SlotEditSerializer(serializers.Serializer):
    """
    Serializer для редагування слота
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 3.1
    """
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    strategy = serializers.ChoiceField(
        choices=['override', 'template_update', 'user_choice'],
        default='user_choice',
        help_text="Strategy for editing template-generated slots"
    )
    
    def validate(self, data):
        """Validate that end_time is after start_time"""
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError({
                'end_time': 'End time must be after start time'
            })
        return data

class SlotDetailSerializer(serializers.ModelSerializer):
    """
    Detailed slot information including source tracking
    """
    class Meta:
        model = TutorAvailabilitySlot
        fields = [
            'id', 'date', 'start_time', 'end_time', 'status',
            'source', 'template_id', 'override_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class BatchSlotEditSerializer(serializers.Serializer):
    """Batch editing of multiple slots"""
    updates = serializers.ListField(
        child=serializers.DictField(),
        max_length=50,
        help_text="List of slot updates (max 50)"
    )
    
    def validate_updates(self, updates):
        """Validate each update in the batch"""
        for update in updates:
            if 'id' not in update:
                raise serializers.ValidationError("Each update must have 'id' field")
            if 'start_time' not in update or 'end_time' not in update:
                raise serializers.ValidationError("Each update must have 'start_time' and 'end_time'")
        return updates
```

#### Views

```python
# Файл: backend/apps/booking/api/views.py

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from ..models import TutorAvailabilitySlot
from ..services import get_slot_editor_service
from .serializers import SlotEditSerializer, SlotDetailSerializer, BatchSlotEditSerializer

class SlotDetailView(APIView):
    """
    GET: Get slot details
    PUT: Update slot
    DELETE: Delete slot
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 3.1
    """
    permission_classes = [IsAuthenticated, IsTutor]
    
    def get(self, request, slot_id):
        """Get slot details"""
        slot = get_object_or_404(
            TutorAvailabilitySlot,
            id=slot_id,
            tutor=request.user
        )
        serializer = SlotDetailSerializer(slot)
        return Response(serializer.data)
    
    def put(self, request, slot_id):
        """
        Update slot with conflict detection and strategy handling
        
        Strategy options:
        - override: Detach slot from template
        - template_update: Update template and regenerate all slots
        - user_choice: Ask user (frontend handles this)
        """
        slot = get_object_or_404(
            TutorAvailabilitySlot,
            id=slot_id,
            tutor=request.user
        )
        
        serializer = SlotEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = get_slot_editor_service()
        
        try:
            updated_slot = service.edit_slot(
                slot_id=slot_id,
                new_start=serializer.validated_data['start_time'],
                new_end=serializer.validated_data['end_time'],
                strategy=serializer.validated_data['strategy'],
                user=request.user
            )
            
            return Response(
                SlotDetailSerializer(updated_slot).data,
                status=status.HTTP_200_OK
            )
            
        except ConflictError as e:
            return Response(
                {'error': 'Conflict detected', 'conflicts': e.conflicts},
                status=status.HTTP_409_CONFLICT
            )
        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
    
    def delete(self, request, slot_id):
        """Delete slot"""
        slot = get_object_or_404(
            TutorAvailabilitySlot,
            id=slot_id,
            tutor=request.user
        )
        
        # Cannot delete booked slots
        if slot.status == TutorAvailabilitySlot.Status.BOOKED:
            return Response(
                {'error': 'Cannot delete booked slot'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        slot.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class SlotBatchEditView(APIView):
    """
    POST: Batch edit multiple slots
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 3.3
    """
    permission_classes = [IsAuthenticated, IsTutor]
    
    def post(self, request):
        """Batch edit slots"""
        serializer = BatchSlotEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = get_slot_editor_service()
        
        results = service.batch_edit_slots(
            updates=serializer.validated_data['updates'],
            user=request.user
        )
        
        return Response({
            'success_count': len([r for r in results if r['success']]),
            'error_count': len([r for r in results if not r['success']]),
            'results': results
        }, status=status.HTTP_200_OK)

class SlotConflictsView(APIView):
    """
    POST: Check for conflicts before editing slot
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 3.3
    """
    permission_classes = [IsAuthenticated, IsTutor]
    
    def post(self, request, slot_id):
        """Check conflicts for proposed slot edit"""
        serializer = SlotEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = get_slot_editor_service()
        
        conflicts = service.detect_slot_conflicts(
            slot_id=slot_id,
            new_start=serializer.validated_data['start_time'],
            new_end=serializer.validated_data['end_time'],
            user=request.user
        )
        
        return Response({
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts
        }, status=status.HTTP_200_OK)
```

#### URL Configuration

```python
# Файл: backend/apps/booking/api/urls.py

from django.urls import path
from .views import SlotDetailView, SlotBatchEditView, SlotConflictsView

urlpatterns = [
    # ... existing patterns
    
    # Slot editing endpoints
    path('slots/<int:slot_id>/', SlotDetailView.as_view(), name='slot-detail'),
    path('slots/<int:slot_id>/conflicts/', SlotConflictsView.as_view(), name='slot-conflicts'),
    path('slots/batch/', SlotBatchEditView.as_view(), name='slot-batch-edit'),
]
```

#### Критерії прийняття
- [ ] Serializers створено та протестовано
- [ ] Views реалізовано з обробкою помилок
- [ ] URL patterns додано
- [ ] API документація оновлено
- [ ] Unit тести покривають всі endpoints
- [ ] Integration тести для conflict detection

---

### Task 1.3: Slot Editor Service

**Пріоритет:** P1 (Високий)  
**Estimated:** 12 годин  
**Owner:** Backend Senior Engineer

#### Service Implementation

```python
# Файл: backend/apps/booking/services/slot_editor.py

from typing import List, Dict, Optional
from datetime import time
from django.db import transaction
from django.contrib.auth import get_user_model
from ..models import TutorAvailabilitySlot, TutorAvailability, CalendarEvent

User = get_user_model()

class ConflictError(Exception):
    """Raised when slot edit conflicts with existing slots or bookings"""
    def __init__(self, conflicts: List[Dict]):
        self.conflicts = conflicts
        super().__init__(f"Slot edit has {len(conflicts)} conflicts")

class SlotEditorService:
    """
    Service for editing availability slots with conflict detection
    
    Reference: AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md, Section 3.3
    """
    
    def edit_slot(
        self,
        slot_id: int,
        new_start: time,
        new_end: time,
        strategy: str,
        user: User
    ) -> TutorAvailabilitySlot:
        """
        Edit a slot with conflict detection and strategy handling
        
        Args:
            slot_id: ID of slot to edit
            new_start: New start time
            new_end: New end time
            strategy: 'override', 'template_update', or 'user_choice'
            user: User making the edit
        
        Returns:
            Updated slot
        
        Raises:
            ConflictError: If conflicts detected
            PermissionError: If user doesn't own the slot
        """
        slot = TutorAvailabilitySlot.objects.select_related('template_id').get(
            id=slot_id,
            tutor=user
        )
        
        # 1. Detect conflicts
        conflicts = self.detect_slot_conflicts(slot_id, new_start, new_end, user)
        
        if conflicts:
            raise ConflictError(conflicts)
        
        # 2. Apply strategy
        if strategy == 'override':
            return self._override_slot(slot, new_start, new_end)
        elif strategy == 'template_update':
            return self._update_template_and_regenerate(slot, new_start, new_end)
        else:
            # For 'user_choice', frontend should have already chosen
            return self._update_slot(slot, new_start, new_end)
    
    @transaction.atomic
    def _override_slot(
        self,
        slot: TutorAvailabilitySlot,
        new_start: time,
        new_end: time
    ) -> TutorAvailabilitySlot:
        """
        Override slot - detach from template
        
        This creates a manual override that won't be affected by template changes
        """
        slot.start_time = new_start
        slot.end_time = new_end
        slot.source = TutorAvailabilitySlot.SlotSource.OVERRIDE
        slot.override_reason = f"Manual edit at {timezone.now().isoformat()}"
        # Keep template_id for audit trail
        slot.save()
        
        return slot
    
    @transaction.atomic
    def _update_template_and_regenerate(
        self,
        slot: TutorAvailabilitySlot,
        new_start: time,
        new_end: time
    ) -> TutorAvailabilitySlot:
        """
        Update template and regenerate all slots from it
        
        This updates the template and regenerates all future slots
        """
        if not slot.template_id:
            raise ValueError("Slot has no template association")
        
        template = slot.template_id
        
        # Update template
        template.start_time = new_start
        template.end_time = new_end
        template.save()
        
        # Regenerate slots from this template
        from .slot_generator import get_slot_generator_service
        generator = get_slot_generator_service()
        generator.regenerate_slots_from_template(template.id)
        
        # Return updated slot
        return TutorAvailabilitySlot.objects.get(id=slot.id)
    
    def _update_slot(
        self,
        slot: TutorAvailabilitySlot,
        new_start: time,
        new_end: time
    ) -> TutorAvailabilitySlot:
        """Simple slot update"""
        slot.start_time = new_start
        slot.end_time = new_end
        slot.save()
        return slot
    
    def detect_slot_conflicts(
        self,
        slot_id: int,
        new_start: time,
        new_end: time,
        user: User
    ) -> List[Dict]:
        """
        Detect conflicts with other slots and booked lessons
        
        Returns:
            List of conflicts with type, severity, and message
        """
        conflicts = []
        
        slot = TutorAvailabilitySlot.objects.get(id=slot_id, tutor=user)
        
        # 1. Check overlaps with other slots on same date
        overlapping_slots = TutorAvailabilitySlot.objects.filter(
            tutor=user,
            date=slot.date,
            status=TutorAvailabilitySlot.Status.AVAILABLE
        ).exclude(id=slot_id)
        
        for other_slot in overlapping_slots:
            if self._times_overlap(new_start, new_end, other_slot.start_time, other_slot.end_time):
                conflicts.append({
                    'type': 'slot_overlap',
                    'severity': 'error',
                    'message': f'Перекриття з слотом {other_slot.start_time}-{other_slot.end_time}',
                    'slot_id': other_slot.id
                })
        
        # 2. Check conflicts with booked lessons
        booked_lessons = CalendarEvent.objects.filter(
            tutor=user,
            start__date=slot.date,
            status__in=[CalendarEvent.Status.SCHEDULED, CalendarEvent.Status.COMPLETED]
        )
        
        for lesson in booked_lessons:
            lesson_start = lesson.start.time()
            lesson_end = lesson.end.time()
            
            if self._times_overlap(new_start, new_end, lesson_start, lesson_end):
                conflicts.append({
                    'type': 'booked_overlap',
                    'severity': 'warning',
                    'message': f'Час перекриває урок з {lesson.student.get_full_name()}',
                    'lesson_id': lesson.id,
                    'student_name': lesson.student.get_full_name()
                })
        
        return conflicts
    
    def _times_overlap(
        self,
        start1: time,
        end1: time,
        start2: time,
        end2: time
    ) -> bool:
        """Check if two time ranges overlap"""
        return start1 < end2 and end1 > start2
    
    def batch_edit_slots(
        self,
        updates: List[Dict],
        user: User
    ) -> List[Dict]:
        """
        Batch edit multiple slots
        
        Args:
            updates: List of {id, start_time, end_time, strategy}
            user: User making the edits
        
        Returns:
            List of results with success/error for each update
        """
        results = []
        
        for update in updates:
            try:
                slot = self.edit_slot(
                    slot_id=update['id'],
                    new_start=update['start_time'],
                    new_end=update['end_time'],
                    strategy=update.get('strategy', 'override'),
                    user=user
                )
                
                results.append({
                    'id': update['id'],
                    'success': True,
                    'slot': SlotDetailSerializer(slot).data
                })
                
            except Exception as e:
                results.append({
                    'id': update['id'],
                    'success': False,
                    'error': str(e)
                })
        
        return results

# Singleton service instance
_slot_editor_service = None

def get_slot_editor_service() -> SlotEditorService:
    """Get singleton instance of SlotEditorService"""
    global _slot_editor_service
    if _slot_editor_service is None:
        _slot_editor_service = SlotEditorService()
    return _slot_editor_service
```

#### Tests

```python
# Файл: backend/apps/booking/tests/test_slot_editor.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from datetime import date, time
from ..models import TutorAvailabilitySlot, TutorAvailability
from ..services.slot_editor import get_slot_editor_service, ConflictError

User = get_user_model()

class SlotEditorServiceTest(TestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(
            email='tutor@test.com',
            password='test123',
            role='tutor'
        )
        
        self.template = TutorAvailability.objects.create(
            tutor=self.tutor,
            day_of_week=1,  # Monday
            start_time=time(10, 0),
            end_time=time(12, 0)
        )
        
        self.slot = TutorAvailabilitySlot.objects.create(
            tutor=self.tutor,
            date=date(2025, 12, 29),  # Monday
            start_time=time(10, 0),
            end_time=time(12, 0),
            status='available',
            day_of_week=1,
            source='template',
            template_id=self.template
        )
        
        self.service = get_slot_editor_service()
    
    def test_edit_slot_override(self):
        """Test editing slot with override strategy"""
        updated_slot = self.service.edit_slot(
            slot_id=self.slot.id,
            new_start=time(11, 0),
            new_end=time(13, 0),
            strategy='override',
            user=self.tutor
        )
        
        self.assertEqual(updated_slot.start_time, time(11, 0))
        self.assertEqual(updated_slot.end_time, time(13, 0))
        self.assertEqual(updated_slot.source, 'override')
        self.assertIsNotNone(updated_slot.override_reason)
    
    def test_edit_slot_template_update(self):
        """Test editing slot with template update strategy"""
        updated_slot = self.service.edit_slot(
            slot_id=self.slot.id,
            new_start=time(11, 0),
            new_end=time(13, 0),
            strategy='template_update',
            user=self.tutor
        )
        
        # Template should be updated
        self.template.refresh_from_db()
        self.assertEqual(self.template.start_time, time(11, 0))
        self.assertEqual(self.template.end_time, time(13, 0))
    
    def test_detect_slot_overlap_conflict(self):
        """Test conflict detection for overlapping slots"""
        # Create another slot on same date
        TutorAvailabilitySlot.objects.create(
            tutor=self.tutor,
            date=date(2025, 12, 29),
            start_time=time(11, 0),
            end_time=time(13, 0),
            status='available',
            day_of_week=1
        )
        
        # Try to edit first slot to overlap with second
        with self.assertRaises(ConflictError) as cm:
            self.service.edit_slot(
                slot_id=self.slot.id,
                new_start=time(10, 30),
                new_end=time(12, 30),
                strategy='override',
                user=self.tutor
            )
        
        conflicts = cm.exception.conflicts
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]['type'], 'slot_overlap')
    
    def test_batch_edit_slots(self):
        """Test batch editing multiple slots"""
        slot2 = TutorAvailabilitySlot.objects.create(
            tutor=self.tutor,
            date=date(2025, 12, 30),  # Tuesday
            start_time=time(14, 0),
            end_time=time(16, 0),
            status='available',
            day_of_week=2
        )
        
        updates = [
            {'id': self.slot.id, 'start_time': time(11, 0), 'end_time': time(13, 0)},
            {'id': slot2.id, 'start_time': time(15, 0), 'end_time': time(17, 0)},
        ]
        
        results = self.service.batch_edit_slots(updates, self.tutor)
        
        self.assertEqual(len(results), 2)
        self.assertTrue(all(r['success'] for r in results))
```

#### Критерії прийняття
- [ ] Service реалізовано з усіма стратегіями
- [ ] Conflict detection працює коректно
- [ ] Transaction safety забезпечено
- [ ] Unit тести покривають всі сценарії
- [ ] Integration тести з БД
- [ ] Performance тести для batch operations
- [ ] Документація оновлено

---

## Моніторинг та метрики

### Prometheus Metrics

```python
# Файл: backend/apps/booking/metrics.py

from prometheus_client import Counter, Histogram

# Slot editing metrics
slot_edit_total = Counter(
    'availability_slot_edit_total',
    'Total number of slot edits',
    ['strategy', 'status']
)

slot_edit_duration = Histogram(
    'availability_slot_edit_duration_seconds',
    'Duration of slot edit operations',
    ['strategy']
)

slot_conflict_total = Counter(
    'availability_slot_conflict_total',
    'Total number of slot conflicts detected',
    ['conflict_type']
)

batch_edit_total = Counter(
    'availability_batch_edit_total',
    'Total number of batch edit operations',
    ['status']
)
```

### Logging

```python
# Додати до всіх service methods
import logging
logger = logging.getLogger(__name__)

logger.info(f"[SlotEditor] Editing slot {slot_id} with strategy {strategy}")
logger.warning(f"[SlotEditor] Conflict detected: {conflicts}")
logger.error(f"[SlotEditor] Failed to edit slot: {str(e)}", exc_info=True)
```

---

## Deployment Checklist

- [ ] Міграції створено та протестовано на staging
- [ ] Backup БД створено
- [ ] Feature flag налаштовано
- [ ] Rollback план підготовлено
- [ ] Моніторинг та алерти налаштовано
- [ ] Документація API оновлено
- [ ] Postman колекція оновлено
- [ ] E2E тести пройшли на staging
- [ ] Performance тести виконано
- [ ] Security audit пройдено

---

## Посилання

- [Архітектурний план](./AVAILABILITY_EDITOR_ARCHITECTURE_PLAN.md)
- [API Contract v0.49.5](./API_CONTRACT_v0495.md)
- [Calendar Manifest v0.49.2](./CALENDAR_MANIFEST_v0492.md)
