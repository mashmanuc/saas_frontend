# Інструкція запуску Celery Worker

> Актуально для локального середовища Windows + Docker (Redis) + Django 5.2

## 1. Попередні вимоги

1. **Python venv** активований (`.venv`).
2. **Django сервер** можна запускати через `python manage.py runserver`.
3. **Docker Desktop** встановлений (для Redis контейнера).
4. У `.env` є валідні налаштування БД та Django.

## 2. Запуск Redis брокера (один раз)

```powershell
# зі статті git-bash / PowerShell у корені проекту
$ docker run -d --name m4sh_redis -p 6379:6379 redis:7-alpine
```

Перевірити, що контейнер працює:

```powershell
$ docker ps -f name=m4sh_redis
```

> Якщо Redis вже запущено — цей крок пропустити.

## 3. Налаштування Django на Redis

У `config/settings.py` вже прописано:
```
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
```
Якщо потрібно змінити брокер — задайте змінні в `.env`.

## 4. Запуск Celery Worker

> Виконувати з каталогу `backend/` (де `manage.py`).

```powershell
# активуємо середовище
$ .\.venv\Scripts\activate

# запускаємо worker
$ python -m celery -A config worker --pool=solo --loglevel=info
```

Після запуску очікувати повідомлення:
```
[INFO/MainProcess] Connected to redis://localhost:6379/0
[INFO/MainProcess] celery@DESKTOP-... ready.
```

> Для зупинки worker: натиснути `Ctrl+C` у вікні або виконати `Stop-Process -Name python -Force`.

## 5. Запуск Django (в іншому терміналі)

```powershell
$ .\.venv\Scripts\activate
$ python manage.py runserver
```

## 6. Перезапуск після змін коду

1. Зупинити поточний worker (`Ctrl+C`).
2. Очистити кеш Python (необовʼязково): `Get-ChildItem -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force`.
3. Запустити worker знову (див. розділ 4).

## 7. Типові проблеми

| Симптом | Причина | Рішення |
|---------|---------|---------|
| `WinError 10061` (немає зʼєднання з AMQP) | RabbitMQ не працює | Параметр `CELERY_BROKER_URL` вказує на RabbitMQ. Змінити на Redis або запустити RabbitMQ. |
| `redis.exceptions.ConnectionError` | Redis контейнер не запущений | Переконатися, що `docker start m4sh_redis`. |
| `log_telemetry_event() got an unexpected keyword argument 'data'` | Стара версія коду у worker | Зупинити worker, видалити `__pycache__`, запустити заново. |
| Worker не бачить нові таски | Worker запущений у старому каталозі | Зупинити та запустити знову з кореня `backend/`. |

## 8. Корисні команди

```powershell
# переглянути логи контейнера Redis
$ docker logs -f m4sh_redis

# видалити контейнер Redis (якщо потрібно перевстановити)
$ docker rm -f m4sh_redis
```

Все! Після цих кроків Celery оброблятиме задачі (генерація слотів, нотифікації тощо).
