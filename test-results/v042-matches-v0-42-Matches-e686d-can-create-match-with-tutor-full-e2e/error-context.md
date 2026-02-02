# Page snapshot

```yaml
- main "Секція авторизації" [ref=e4]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - heading "Вхід" [level=1] [ref=e8]
      - paragraph [ref=e9]: Введіть email і пароль, щоб продовжити.
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Email *
        - textbox "Email *" [ref=e14]: student@test.com
      - generic [ref=e15]:
        - generic [ref=e16]: Пароль *
        - textbox "Пароль *" [ref=e18]: password123
      - link "Забули пароль?" [ref=e19] [cursor=pointer]:
        - /url: /auth/forgot-password
      - button "Увійти" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: Увійти
      - paragraph [ref=e22]: Невірний email або пароль
    - paragraph [ref=e23]:
      - text: Немає акаунта?
      - link "Зареєструватися" [ref=e24] [cursor=pointer]:
        - /url: /auth/register
```