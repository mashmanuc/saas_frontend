# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main "Секція авторизації" [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - paragraph [ref=e8]: Акаунт заблоковано
        - paragraph [ref=e9]: Заблоковано до 2/2/2026, 8:43:27 AM
        - button "Запросити розблокування" [ref=e10] [cursor=pointer]:
          - generic [ref=e11]: Запросити розблокування
      - generic [ref=e12]:
        - heading "Вхід" [level=1] [ref=e13]
        - paragraph [ref=e14]: Введіть email і пароль, щоб продовжити.
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Email *
          - textbox "Email *" [ref=e19]: locked@example.com
        - generic [ref=e20]:
          - generic [ref=e21]: Пароль *
          - textbox "Пароль *" [ref=e23]: password
        - link "Забули пароль?" [ref=e24] [cursor=pointer]:
          - /url: /auth/forgot-password
        - button "Увійти" [ref=e25] [cursor=pointer]:
          - generic [ref=e26]: Увійти
        - paragraph [ref=e27]: Сталася помилка. Спробуйте ще раз
      - paragraph [ref=e28]:
        - text: Немає акаунта?
        - link "Зареєструватися" [ref=e29] [cursor=pointer]:
          - /url: /auth/register
  - generic [ref=e31]:
    - button [ref=e32] [cursor=pointer]:
      - img [ref=e33]
    - heading "Помилка сервера. Спробуйте пізніше." [level=2] [ref=e37]
    - paragraph [ref=e39]: Акаунт тимчасово заблоковано
    - button "OK" [ref=e41] [cursor=pointer]:
      - generic [ref=e42]: OK
```