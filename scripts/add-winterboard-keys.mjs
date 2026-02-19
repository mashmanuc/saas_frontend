#!/usr/bin/env node
/**
 * Add missing winterboard.* i18n keys to uk.json and en.json
 * Based on i18n-check report: 6 missing keys detected
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');

const missingKeys = {
  'winterboard.room.menu': 'Меню',
  'winterboard.room.home': 'На головну',
  'winterboard.sidebar.home': 'Головна',
  'winterboard.sidebar.boards': 'Мої дошки',
  'winterboard.sidebar.dashboard': 'Панель керування',
  'winterboard.sidebar.settings': 'Налаштування'
};

const missingKeysEn = {
  'winterboard.room.menu': 'Menu',
  'winterboard.room.home': 'Home',
  'winterboard.sidebar.home': 'Home',
  'winterboard.sidebar.boards': 'My Boards',
  'winterboard.sidebar.dashboard': 'Dashboard',
  'winterboard.sidebar.settings': 'Settings'
};

async function addMissingKeys() {
  console.log('[add-winterboard-keys] Starting...');

  // Read uk.json
  const ukPath = path.join(localesDir, 'uk.json');
  const ukContent = await fs.readFile(ukPath, 'utf-8');
  const ukData = JSON.parse(ukContent);

  // Read en.json
  const enPath = path.join(localesDir, 'en.json');
  const enContent = await fs.readFile(enPath, 'utf-8');
  const enData = JSON.parse(enContent);

  // Add missing keys to uk.json
  if (!ukData.winterboard) {
    ukData.winterboard = {};
  }
  if (!ukData.winterboard.room) {
    ukData.winterboard.room = {};
  }
  if (!ukData.winterboard.sidebar) {
    ukData.winterboard.sidebar = {};
  }

  ukData.winterboard.room.menu = missingKeys['winterboard.room.menu'];
  ukData.winterboard.room.home = missingKeys['winterboard.room.home'];
  ukData.winterboard.sidebar.home = missingKeys['winterboard.sidebar.home'];
  ukData.winterboard.sidebar.boards = missingKeys['winterboard.sidebar.boards'];
  ukData.winterboard.sidebar.dashboard = missingKeys['winterboard.sidebar.dashboard'];
  ukData.winterboard.sidebar.settings = missingKeys['winterboard.sidebar.settings'];

  // Add missing keys to en.json
  if (!enData.winterboard) {
    enData.winterboard = {};
  }
  if (!enData.winterboard.room) {
    enData.winterboard.room = {};
  }
  if (!enData.winterboard.sidebar) {
    enData.winterboard.sidebar = {};
  }

  enData.winterboard.room.menu = missingKeysEn['winterboard.room.menu'];
  enData.winterboard.room.home = missingKeysEn['winterboard.room.home'];
  enData.winterboard.sidebar.home = missingKeysEn['winterboard.sidebar.home'];
  enData.winterboard.sidebar.boards = missingKeysEn['winterboard.sidebar.boards'];
  enData.winterboard.sidebar.dashboard = missingKeysEn['winterboard.sidebar.dashboard'];
  enData.winterboard.sidebar.settings = missingKeysEn['winterboard.sidebar.settings'];

  // Write back with proper formatting
  await fs.writeFile(ukPath, JSON.stringify(ukData, null, 2) + '\n', 'utf-8');
  await fs.writeFile(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf-8');

  console.log('[add-winterboard-keys] ✓ Added 6 missing keys to uk.json');
  console.log('[add-winterboard-keys] ✓ Added 6 missing keys to en.json');
  console.log('[add-winterboard-keys] Done');
}

addMissingKeys().catch((err) => {
  console.error('[add-winterboard-keys] Error:', err);
  process.exit(1);
});
