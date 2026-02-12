const fs = require('fs');
const path = require('path');

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json');

const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'));

// Додаємо missing key dashboard.student.cta.chatWithTutor
ukData.dashboard = ukData.dashboard || {};
ukData.dashboard.student = ukData.dashboard.student || {};
ukData.dashboard.student.cta = ukData.dashboard.student.cta || {};
ukData.dashboard.student.cta.chatWithTutor = 'Написати репетитору';

fs.writeFileSync(ukPath, JSON.stringify(ukData, null, 2) + '\n', 'utf-8');
console.log('✓ Added dashboard.student.cta.chatWithTutor');
