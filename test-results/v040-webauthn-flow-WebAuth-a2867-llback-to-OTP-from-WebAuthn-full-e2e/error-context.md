# Page snapshot

```yaml
- main "Секція авторизації" [ref=e4]:
  - generic [ref=e5]:
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
          - textbox "Пароль *" [ref=e18]: password123
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
      - generic [ref=e27]:
        - img [ref=e29]
        - heading "Автентифікація WebAuthn" [level=2] [ref=e38]
        - generic [ref=e39]: Beta
      - paragraph [ref=e41]: Використайте відбиток пальця, Face ID або апаратний ключ для входу.
      - generic [ref=e42]:
        - button "Використати OTP замість цього" [ref=e43] [cursor=pointer]
        - generic [ref=e44]:
          - button "Скасувати" [ref=e45] [cursor=pointer]
          - button "Автентифікувати" [ref=e46] [cursor=pointer]:
            - img [ref=e47]
            - text: Автентифікувати
```