const fs = require('fs');

const ukPath = 'src/i18n/locales/uk.json';
const enPath = 'src/i18n/locales/en.json';

const ukContent = fs.readFileSync(ukPath, 'utf8');
const enContent = fs.readFileSync(enPath, 'utf8');

const uk = JSON.parse(ukContent);
const en = JSON.parse(enContent);

const missingKeys = {
  'contactModal.title': 'Контакти',
  'contactModal.inquiryPreview': 'Попередній перегляд',
  'contactModal.unlockedContactsTitle': 'Розблоковані контакти',
  'common.unlocked': 'Розблоковано',
  'contactModal.contactTypeLabel': 'Тип контакту',
  'contactModal.tokenCostLabel': 'Вартість',
  'contactModal.noTokensMessage': 'Недостатньо токенів',
  'contactModal.buyTokensButton': 'Купити токени',
  'contactModal.cancelButton': 'Скасувати',
  'contactModal.unlockButton': 'Розблокувати',
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
  setDeep(uk, key, value);
  setDeep(en, key, value);
});

fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
console.log(`Added ${Object.keys(missingKeys).length} keys`);
