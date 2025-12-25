1) UI/DOM структура (що ти вже витягнув через DevTools)
Сітка

Є контейнер типу snapshot:
styles_bordSnapshot__...

Усередині — grid:
styles_bordGrid__...

Далі 7 колонок-днів:
styles_dayCol__... × 7

У кожній колонці — стек клітинок часу:
styles_cell__... повторюється багато разів (у твоєму прикладі години 06:00–22:00)

Стани клітинок (CSS-класи)

По твоєму outerHTML видно такі “прапорці” стану:

styles_notAllow__... — слот недоступний (заборонено)

styles_avaliable__... — слот доступний (available)

styles_hover__... — hover-ефект

у першій колонці в клітинці є <span class="styles_hour__...">HH:MM</span>, в інших — може бути пусто (час по осі один раз)

Події/уроки (івенти) — окремим шаром поверх сітки

Івенти не “внутрі клітинки”, а абсолютно позиціоновані поверх grid:

div.styles_event__... styles_actual__...

draggable="true"

inline-style ключове:

top: ...px (вертикальна позиція)

left: ...px (колонка дня)

height: ...px (тривалість)

width: ...px (ширина колонки)

Всередині:

styles_name__... — ім’я учня

styles_time__... — “17:50-18:50”

✅ Висновок: двошаровий календар
Layer A: статична сітка клітинок (доступність/заборони)
Layer B: overlay івентів (draggable блоки з px-координатами)

2) Як вони грузять дані (API-патерн)
“Week snapshot” одним запитом

Основний запит:
GET https://api.bukischool.com.ua/tutor/calendar/get?page=0

У відповіді одразу є все потрібне для рендеру тижня:

days — мета по днях тижня (22–28 грудня 2025 у твоєму прикладі)

events — уроки згруповані по day (ключі "22", "26", "28")

accessible_time — доступні слоти (окремий список)

orders — список замовлень (для модалки створення/прив’язки уроку)

довідники:

class_missed_reasons

class_deleted_reasons

плюс службове: salary, billing_period_wages, zoom_link

✅ Висновок: один snapshot = один truth для тижня (дуже “SSOT-like”).

3) CRUD уроків (як відчувається їхня логіка)
Видалення

POST/DELETE https://api.bukischool.com.ua/tutor/calendar_event/class/delete

відповідає просто: status: success, data: []

після цього фронт не чекає “новий стан” з delete-відповіді — він робить refetch snapshot (/tutor/calendar/get)

Отримати деталі уроку (для модалки/редагування)

GET https://api.bukischool.com.ua/tutor/calendar_event/class/get?id=...

повертає event + довідники:

durations

class_done_statuses

class_paid_statuses

class_types

regularities

tutors_count_types

✅ Висновок: вони розділяють:

week snapshot для рендера

event details для модалки/редагування

4) Як визначається “статус клітинки” у UI (по твоїм даним)

У них явно є 3 базові стани для тайм-слайсу:

not allowed (styles_notAllow)

available (styles_avaliable)

(імовірно) нейтральний/порожній — коли немає notAllow/available класів

А уроки (booked) — не стан клітинки, а окремі overlay blocks.

5) Найважливіше, що повторити у нас (короткий чекліст)

Week Snapshot endpoint (один запит → усі дані для тижня)

Grid cells як “фон” + events overlay як draggable blocks

CRUD відповіді короткі → після мутації refetch snapshot

“Event details endpoint” повертає довідники для модалки

Доступність тримається окремо (accessible_time) і мапиться на клітинки