# Page snapshot

```yaml
- generic [ref=e1]:
  - main "Секція авторизації" [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - heading "Вхід" [level=1] [ref=e8]
        - paragraph [ref=e9]: Введіть email і пароль, щоб продовжити.
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Email *
          - textbox "Email *" [ref=e14]: test@example.com
        - generic [ref=e15]:
          - generic [ref=e16]: Пароль *
          - textbox "Пароль *" [active] [ref=e18]: wrong-password
        - link "Забули пароль?" [ref=e19] [cursor=pointer]:
          - /url: /auth/forgot-password
        - button "Увійти" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: Увійти
        - paragraph [ref=e22]: Сталася помилка. Спробуйте ще раз
      - paragraph [ref=e23]:
        - text: Немає акаунта?
        - link "Зареєструватися" [ref=e24] [cursor=pointer]:
          - /url: /auth/register
  - generic [ref=e26]:
    - button [ref=e27] [cursor=pointer]:
      - img [ref=e28]
    - heading "Помилка сервера. Спробуйте пізніше." [level=2] [ref=e32]
    - paragraph [ref=e34]: "Сталася помилка на сервері. Спробуй ще раз пізніше. (request_id: 09e4491f-ae94-4922-9950-f4bd803d53f2)"
    - button "OK" [ref=e36] [cursor=pointer]:
      - generic [ref=e37]: OK
```