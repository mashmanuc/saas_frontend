1) Запусти фронтенд (Vite) так, щоб Puppeteer точно бачив
Варіант А (найчастіший, localhost)

У корені фронтенда:

npm install
npm run dev -- --host 127.0.0.1 --port 5173


Перевір руками в браузері:

http://127.0.0.1:5173

Чому 127.0.0.1, а не localhost?
Бо інколи MCP/Proxy дивно резолвить localhost, а 127.0.0.1 працює стабільніше.

Варіант B (якщо агент запускається “поруч” і не бачить localhost)
npm run dev -- --host 0.0.0.0 --port 5173


Тоді відкривати:

http://<IP_твого_ПК>:5173

IP дізнатись:

Windows: ipconfig (IPv4 Address)

2) Запусти бекенд (щоб API не 404/ CORS)
Якщо Django (типово для m4sh)

У папці backend:

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver 127.0.0.1:8000


Перевір:

http://127.0.0.1:8000/health (або будь-який ваш ендпоінт)

Якщо бекенд в Docker
docker compose up -d


Перевір:

docker ps

3) Налаштуй фронт, щоб ходив в правильний API

Перевір .env (або .env.local) у фронтенді, наприклад:

VITE_API_BASE_URL=http://127.0.0.1:8000


Після зміни env перезапусти Vite.

4) Запуск Puppeteer/MCP так, щоб агент реально “зайшов”
Мінімальний тест, що агент бачить браузер

Скажи агенту:

відкрити https://example.com

зробити screenshot

Кажу це не для “води”, а щоб відсікти проблему: MCP не стартує vs твій сайт.

5) Часті причини, чому агент не може відкрити сторінку
“The pipe is being closed”

Зазвичай означає:

MCP Puppeteer сервер впав/не підключився

заборонений доступ до localhost

браузер не стартує (policy/permissions)

Що робити швидко:

відкрий MCP tools → переконайся, що Puppeteer “Connected/Ready”

якщо є перемикач “allow dangerous” / “allow local network” — увімкни

тест https://example.com як я вище написав

6) Готовий короткий промпт агенту (після запуску серверів)
Open http://127.0.0.1:5173.
Wait for page load.
Login with provided credentials.
After login, open Calendar → enable v0.55.
Capture console errors and network requests to /ws/v1/calendar/week/v055.
Take a screenshot of the calendar.