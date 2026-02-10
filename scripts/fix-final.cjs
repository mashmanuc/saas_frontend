const fs = require('fs');

const ukPath = 'src/i18n/locales/uk.json';
const enPath = 'src/i18n/locales/en.json';

const ukContent = fs.readFileSync(ukPath, 'utf8');
const enContent = fs.readFileSync(enPath, 'utf8');

const uk = JSON.parse(ukContent);
const en = JSON.parse(enContent);

// Last 7 missing keys for uk.json
const ukKeys = {
  'contacts.ledger.change': 'Зміна',
  'contacts.ledger.balance': 'Баланс',
  'contacts.allowance.nextGrant': 'Наступне нарахування',
  'contacts.allowance.received': 'Отримано',
  'contacts.allowance.notStarted': 'Ще не розпочато',
  'contacts.grant.reasonHelp': 'Вкажіть причину нарахування',
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

// Add to UK
Object.entries(ukKeys).forEach(([key, value]) => {
  setDeep(uk, key, value);
  setDeep(en, key, value);
});

// Fix extra keys in en.json - rename ledger.type.* to ledger.types.*
if (en.contacts?.ledger?.type) {
  const types = en.contacts.ledger.type;
  en.contacts.ledger.types = { ...en.contacts.ledger.types, ...types };
  delete en.contacts.ledger.type;
}

fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
console.log('Added 6 keys to both locales, fixed extra keys in en.json');
