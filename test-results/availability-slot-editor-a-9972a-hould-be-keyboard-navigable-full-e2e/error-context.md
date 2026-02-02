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
        - textbox "Email *" [ref=e14]
        - paragraph [ref=e15]: Введіть email
      - generic [ref=e16]:
        - generic [ref=e17]: Пароль *
        - textbox "Пароль *" [active] [ref=e19]
        - paragraph [ref=e20]: Введіть пароль
      - link "Забули пароль?" [ref=e21] [cursor=pointer]:
        - /url: /auth/forgot-password
      - button "Увійти" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: Увійти
    - paragraph [ref=e24]:
      - text: Немає акаунта?
      - link "Зареєструватися" [ref=e25] [cursor=pointer]:
        - /url: /auth/register
```