import fs from 'node:fs'
import path from 'node:path'

const enPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'en.json')
const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'))

// Додати contacts секцію якщо її немає
if (!enData.contacts) {
  enData.contacts = {
    "title": "Contacts",
    "subtitle": "Get in touch",
    "email": "Email",
    "phone": "Phone",
    "address": "Address",
    "sellerInfo": "Seller Information",
    "unlockPrompt": "To see student contacts and chat, unlock access",
    "unlockButton": "Unlock Contacts",
    "studentContacts": "Student Contacts",
    "revokeButton": "Revoke Access",
    "loadContacts": "Load Contacts",
    "noContactsAvailable": "Contacts not available",
    "balance": {
      "label": "Contacts",
      "ariaLabel": "Contact balance",
      "error": "Failed to load balance"
    },
    "ledger": {
      "title": "Contact History",
      "loading": "Loading...",
      "error": "Failed to load history",
      "empty": "History is empty",
      "noData": "No data available"
    }
  }
}

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf-8')

console.log('✓ Added contacts section to en.json')
