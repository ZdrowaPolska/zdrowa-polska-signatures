import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');
const PHOTO_DIR = path.join(ROOT, 'data', 'photos');
const VCARD_DIR = path.join(ROOT, 'data', 'vcards');
const SITE_DIR = path.join(ROOT, 'site');
const PUBLIC_BASE_URL = 'https://zdrowapolska.github.io/zdrowa-polska-signatures';

await fs.rm(SITE_DIR, { recursive: true, force: true });
await fs.mkdir(path.join(SITE_DIR, 'assets', 'icons'), { recursive: true });
await fs.mkdir(path.join(SITE_DIR, 'photos'), { recursive: true });
await fs.mkdir(path.join(SITE_DIR, 'contacts'), { recursive: true });
await fs.mkdir(path.join(SITE_DIR, 'qr'), { recursive: true });

const logoSvg = await fs.readFile(path.join(ASSETS_DIR, 'logo.svg'));
await sharp(logoSvg)
  .trim()
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

  const sourcePath = path.join(PHOTO_DIR, name);
  const slug = path.parse(name).name;
  const size = 192;

  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  await sharp(sourcePath)
    .rotate()
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(SITE_DIR, 'photos', `${slug}.png`));
}

try {
  const vcardNames = await fs.readdir(VCARD_DIR);

  for (const name of vcardNames) {
    if (name.startsWith('.') || path.extname(name).toLowerCase() !== '.vcf') continue;

    const sourcePath = path.join(VCARD_DIR, name);
    const slug = path.parse(name).name;
    const targetVcf = path.join(SITE_DIR, 'contacts', `${slug}.vcf`);
    const contactUrl = `${PUBLIC_BASE_URL}/contacts/${encodeURIComponent(slug)}.vcf`;

    await fs.copyFile(sourcePath, targetVcf);

    await QRCode.toFile(
      path.join(SITE_DIR, 'qr', `${slug}.png`),
      contactUrl,
      {
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 1200
      }
    );

    await QRCode.toFile(
      path.join(SITE_DIR, 'qr', `${slug}.svg`),
      contactUrl,
      {
        errorCorrectionLevel: 'H',
        margin: 4,
        type: 'svg'
      }
    );
  }
} catch (e) {
  if (e && e.code !== 'ENOENT') throw e;
}

await fs.writeFile(
  path.join(SITE_DIR, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Zdrowa Polska signature assets</title>',
  'utf8'
);

console.log('Published Gmail signature assets, employee vCards and printable QR codes.');
