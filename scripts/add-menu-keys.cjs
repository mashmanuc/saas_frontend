const fs = require('fs');
const path = require('path');

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json');

const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'));

// Додаємо missing keys
ukData.menu = ukData.menu || {};
ukData.menu.billing = 'Білінг';
ukData.menu.booking = 'Бронювання';
ukData.menu.notifications = 'Сповіщення';

fs.writeFileSync(ukPath, JSON.stringify(ukData, null, 2) + '\n', 'utf-8');
console.log('✓ Added 3 menu keys');
