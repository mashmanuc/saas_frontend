import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC_MODULES_DIR = path.join(ROOT, 'src', 'modules');

async function collectFiles(dir, acc) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name);
    if (ext !== '.ts' && ext !== '.js') continue;
    if (entry.name.endsWith('.d.ts')) continue;

    const relative = path.relative(SRC_MODULES_DIR, fullPath);
    if (relative.startsWith('..')) continue;

    const key = relative.slice(0, -ext.length).replace(/\\/g, '/');
    if (!acc.has(key)) {
      acc.set(key, { ts: [], js: [] });
    }

    acc.get(key)[ext.slice(1)].push(fullPath.replace(/\\/g, '/'));
  }
}

async function main() {
  const candidates = new Map();
  await collectFiles(SRC_MODULES_DIR, candidates);

  const conflicts = [];
  for (const [key, { ts, js }] of candidates.entries()) {
    if (ts.length && js.length) {
      conflicts.push({ key, ts, js });
    }
  }

  if (conflicts.length) {
    console.error('❌ Found .js/.ts shadowing conflicts under src/modules:');
    for (const conflict of conflicts) {
      console.error(`- ${conflict.key}`);
      conflict.ts.forEach((file) => console.error(`   • .ts: ${file}`));
      conflict.js.forEach((file) => console.error(`   • .js: ${file}`));
    }
    console.error(
      '\nRemove the duplicate .js files or ensure only one extension exists per module path.'
    );
    process.exit(1);
  }

  console.log('✅ No .js/.ts shadowing detected in src/modules.');
}

main().catch((error) => {
  console.error('lint:api-duplicates failed:', error);
  process.exit(1);
});
