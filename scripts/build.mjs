import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'users');
const PHOTO_DIR = path.join(ROOT, 'data', 'photos');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SITE_DIR = path.join(ROOT, 'site');

const BLUE = '#0B6FA4';
const GRAY = '#555555';

function esc(s='') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function dataUri(mime, buf) {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function ensureCleanSite() {
  await fs.rm(SITE_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(SITE_DIR, 'signatures'), { recursive: true });
  await fs.mkdir(path.join(SITE_DIR, 'icons'), { recursive: true });
  await fs.mkdir(path.join(SITE_DIR, 'go'), { recursive: true });
}

async function readOptional(file) {
  try { return await fs.readFile(file); } catch { return null; }
}

async function imageMime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function signatureSvg(user, photoBuf, photoMime, logoBuf) {
  const W = 720, H = 190;
  const photo = photoBuf ? dataUri(photoMime, photoBuf) : null;
  const logo = dataUri('image/svg+xml', logoBuf);

  const job = user.jobTitle
    ? `<text x="245" y="59" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="${GRAY}">${esc(user.jobTitle)}</text>`
    : '';
  const phone = user.phone
    ? `<text x="245" y="119" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="${GRAY}">Tel: ${esc(user.phone)}</text>`
    : '';
  const emailY = user.phone ? 145 : 122;
  const websiteY = user.phone ? 169 : 148;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <defs><clipPath id="photoClip"><circle cx="91" cy="57" r="50"/></clipPath></defs>
  ${photo
    ? `<image href="${photo}" x="41" y="7" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`
    : `<circle cx="91" cy="57" r="50" fill="#EEF3F3"/><circle cx="91" cy="45" r="18" fill="#9BAEAF"/><path d="M55 94c4-24 18-37 36-37s32 13 36 37" fill="#9BAEAF"/>`
  }
  <image href="${logo}" x="18" y="113" width="160" height="77" preserveAspectRatio="xMidYMid meet"/>
  <rect x="210" y="7" width="3" height="176" fill="${BLUE}"/>
  <text x="245" y="33" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="#111111">${esc(user.fullName)}</text>
  ${job}
  <text x="245" y="88" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="700" fill="${BLUE}">${esc(user.company)}</text>
  ${phone}
  <text x="245" y="${emailY}" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="${GRAY}">Email: <tspan fill="${BLUE}">${esc(user.email)}</tspan></text>
  <text x="245" y="${websiteY}" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="${GRAY}">Strona: <tspan fill="${BLUE}">${esc(user.website)}</tspan></text>
</svg>`;
}

async function buildUser(file) {
  const slug = path.basename(file, '.json');
  const user = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'));
  let photoBuf = null, photoMime = null;
  if (user.photoFile) {
    const p = path.join(PHOTO_DIR, user.photoFile);
    photoBuf = await readOptional(p);
    if (photoBuf) photoMime = await imageMime(p);
  }
  const logoBuf = await fs.readFile(path.join(ASSETS_DIR, 'logo.svg'));
  const svg = await signatureSvg(user, photoBuf, photoMime, logoBuf);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(SITE_DIR, 'signatures', `${slug}.png`));

  if (user.linkedin) {
    const goDir = path.join(SITE_DIR, 'go', slug, 'linkedin');
    await fs.mkdir(goDir, { recursive: true });
    const redirect = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${esc(user.linkedin)}"><link rel="canonical" href="${esc(user.linkedin)}"></head><body><a href="${esc(user.linkedin)}">Continue</a></body></html>`;
    await fs.writeFile(path.join(goDir, 'index.html'), redirect, 'utf8');
  }
}

async function buildIcons() {
  for (const name of ['linkedin', 'facebook', 'youtube']) {
    const svg = await fs.readFile(path.join(ASSETS_DIR, 'icons', `${name}.svg`));
    await sharp(svg).resize(32, 32).png().toFile(path.join(SITE_DIR, 'icons', `${name}.png`));
  }
}

await ensureCleanSite();
await buildIcons();
const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json')).sort();
for (const file of files) await buildUser(file);
await fs.writeFile(path.join(SITE_DIR, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Zdrowa Polska signature assets</title>', 'utf8');
console.log(`Built ${files.length} signature(s).`);
