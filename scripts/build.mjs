import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');
const PHOTO_DIR = path.join(ROOT, 'data', 'photos');
const SITE_DIR = path.join(ROOT, 'site');

await fs.rm(SITE_DIR, { recursive: true, force: true });
await fs.mkdir(path.join(SITE_DIR, 'assets', 'icons'), { recursive: true });
await fs.mkdir(path.join(SITE_DIR, 'photos'), { recursive: true });

const logoSvg = await fs.readFile(path.join(ASSETS_DIR, 'logo.svg'));
await sharp(logoSvg)
  .resize({ width: 300 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(SITE_DIR, 'assets', 'logo.png'));

const neutralSvg = await fs.readFile(path.join(ASSETS_DIR, 'neutral-avatar.svg'));
await sharp(neutralSvg)
  .resize(160, 160)
  .png({ compressionLevel: 9 })
  .toFile(path.join(SITE_DIR, 'assets', 'neutral-avatar.png'));

for (const name of ['linkedin', 'facebook', 'youtube']) {
  const svg = await fs.readFile(path.join(ASSETS_DIR, 'icons', `${name}.svg`));
  await sharp(svg)
    .resize(64, 64)
    .png({ compressionLevel: 9 })
    .toFile(path.join(SITE_DIR, 'assets', 'icons', `${name}.png`));
}

for (const name of await fs.readdir(PHOTO_DIR)) {
  if (name.startsWith('.')) continue;
  await fs.copyFile(path.join(PHOTO_DIR, name), path.join(SITE_DIR, 'photos', name));
}

await fs.writeFile(
  path.join(SITE_DIR, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Zdrowa Polska signature assets</title>',
  'utf8'
);

console.log('Published Gmail signature assets.');
