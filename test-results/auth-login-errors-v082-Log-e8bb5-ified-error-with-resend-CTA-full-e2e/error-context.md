# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main "Секція авторизації" [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - heading "Вхід" [level=1] [ref=e8]
        - paragraph [ref=e9]: Введіть email і пароль, щоб продовжити.
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Email *
          - textbox "Email *" [ref=e14]: unverified@example.com
        - generic [ref=e15]:
          - generic [ref=e16]: Пароль *
          - textbox "Пароль *" [ref=e18]: password123
        - link "Забули пароль?" [ref=e19] [cursor=pointer]:
          - /url: /auth/forgot-password
        - button "Увійти" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: Увійти
      - paragraph [ref=e22]:
        - text: Немає акаунта?
        - link "Зареєструватися" [ref=e23] [cursor=pointer]:
          - /url: /auth/register
  - generic [ref=e25]:
    - button [ref=e26] [cursor=pointer]:
      - img [ref=e27]
    - heading "Помилка сервера. Спробуйте пізніше." [level=2] [ref=e31]
    - paragraph [ref=e33]: Немає зʼєднання з сервером. Перевірте мережу і спробуйте ще раз.
    - button "OK" [ref=e35] [cursor=pointer]:
      - generic [ref=e36]: OK
```