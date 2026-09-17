import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'users');
const OUT_DIR = path.join(ROOT, 'site', 'hybrid');

const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json'));
for (const file of files) {
  const slug = path.basename(file, '.json');
  const dir = path.join(OUT_DIR, slug);
  await fs.copyFile(path.join(dir, 'core.png'), path.join(dir, 'core-admin-v2.png'));
}

console.log(`Created ${files.length} cache-busted Google Admin core image(s).`);
