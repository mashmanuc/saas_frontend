const fs = require('fs');

const ukPath = 'src/i18n/locales/uk.json';
const content = fs.readFileSync(ukPath, 'utf8');
const data = JSON.parse(content);

const missingKeys = {
  // nav keys
  'nav.calendar': 'Календар',
  'nav.inquiries': 'Запити',
  'nav.bookings': 'Бронювання',
  'nav.chat': 'Чат',
  'nav.contacts': 'Контакти',
  'nav.billing': 'Оплата',
  
  // common.restore
  'common.restore': 'Відновити',
  
  // relations.actions
  'relations.actions.deleteConfirm': 'Видалити стосунки?',
  'relations.actions.deleteError': 'Не вдалося видалити',
  'relations.actions.restoreError': 'Не вдалося відновити',
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
console.log(`Added ${Object.keys(missingKeys).length} missing keys`);
