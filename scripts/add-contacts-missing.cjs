const fs = require('fs');

const ukPath = 'src/i18n/locales/uk.json';
const content = fs.readFileSync(ukPath, 'utf8');
const data = JSON.parse(content);

const missingKeys = {
  'contacts.balance.low': 'Низький баланс',
  'contacts.tokens': 'токенів',
  'contacts.balance.zeroMessage': 'У вас закінчилися токени. Придбайте нові.',
  'contacts.balance.lowMessage': 'Мало токенів. Рекомендуємо поповнити.',
  'contacts.ledger.allTypes': 'Всі типи',
  'contacts.ledger.types.purchase': 'Покупка',
  'contacts.ledger.types.deduction': 'Списання',
  'contacts.ledger.types.refund': 'Повернення',
  'contacts.ledger.types.grant': 'Нарахування',
  'contacts.ledger.types.bonus': 'Бонус',
  'contacts.ledger.refresh': 'Оновити',
  'contacts.ledger.date': 'Дата',
  'contacts.ledger.type': 'Тип',
  'contacts.allowance.month': 'Місяць',
  'contacts.grant.amountPlaceholder': 'Введіть кількість',
  'contacts.grant.reasonPlaceholder': 'Вкажіть причину',
  'contacts.grant.subscription': 'Підписка',
  'contacts.grant.subscriptionPlaceholder': 'Виберіть підписку',
  'contacts.balance.title': 'Баланс',
  'contacts.balance.zeroBalance': 'Немає токенів',
  'contacts.balance.lowBalance': 'Низький баланс',
  'contacts.balance.addTokens': 'Додати токени',
  'contacts.balance.viewHistory': 'Історія',
  'contacts.balance.tokens': 'токенів',
  'contacts.errors.loadFailed': 'Помилка завантаження',
  'contacts.errors.purchaseFailed': 'Помилка покупки',
  'contacts.errors.grantFailed': 'Помилка нарахування',
  'contacts.ledger.columns.date': 'Дата',
  'contacts.ledger.columns.type': 'Тип',
  'contacts.ledger.columns.description': 'Опис',
  'contacts.ledger.columns.amount': 'Сума',
  'contacts.ledger.columns.balance': 'Баланс',
  'contacts.purchase.currentBalance': 'Поточний баланс',
  'contacts.purchase.perToken': 'за токен',
  'contacts.purchase.noPackages': 'Немає пакетів',
  'contacts.purchase.submit': 'Придбати',
  'contacts.unlockPrompt': 'Розблокувати контакт',
  'contacts.unlockButton': 'Розблокувати',
  'contacts.studentContacts': 'Контакти студента',
  'contacts.noContactsAvailable': 'Немає контактів',
  'contacts.loadContacts': 'Завантажити',
  'contacts.revokeButton': 'Відкликати',
  'contacts.email': 'Email',
  'contacts.phone': 'Телефон',
  'contacts.address': 'Адреса',
  'contacts.sellerInfo': 'Інформація про продавця',
};

function setDeep(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

Object.entries(missingKeys).forEach(([key, value]) => {
  setDeep(data, key, value);
});

fs.writeFileSync(ukPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Added ${Object.keys(missingKeys).length} keys`);
