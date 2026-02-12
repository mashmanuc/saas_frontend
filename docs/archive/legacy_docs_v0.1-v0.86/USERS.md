Ось створені тьютори (усі з паролем TutorTest123!):
DELETED:
.venv\Scripts\python.exe manage.py shell -c "from apps.users.models import User; emails=['m9@gmail.com','m8@gmail.com','m7@gmail.com','m6@gmail.com','m5@gmail.com','test@example.com','mfa-user@example.com','locked@example.com','e2e-staff@example.com','e2e-student@example.com','m3@gmail.com']; qs=User.objects.filter(email__in=emails); deleted=list(qs.values_list('email', flat=True)); count=qs.count(); qs.delete(); print('Deleted', count, 'users:'); [print(email) for email in deleted]"





Email + пароль із цього списку можна використовувати для ручного тестування.
Updated passwords for 10 tutors to 'TutorTest123!'

e2e-staff@example.com


admin 
python manage.py create_operator_user admin@example.com --admin



Огляд профілю V2
http://127.0.0.1:5173/profile-v2/overview
Редагування профілю V2
http://127.0.0.1:5173/profile-v2/edit
Legacy редактор / панель публікації (теперішній пункт меню “Профіль тьютора”)
http://127.0.0.1:5173/marketplace/my-profile
Маркетплейс із карткою тьютора (перевірка публічної видачі)
http://127.0.0.1:5173/marketplace
Якщо треба швидко повернутись на загальний дашборд після тестів
http://127.0.0.1:5173/tutor


python manage.py runserver

python -m daphne -b 0.0.0.0 -p 8000 config.asgi:application

python -m celery -A config worker --pool=solo --loglevel=info

npm run dev -- --host 0.0.0.0 --port 5173