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
const BASE_URL = 'https://zdrowapolska.github.io/zdrowa-polska-signatures';

const DISCLAIMER_PL = 'Niniejsza wiadomość wraz z załącznikami zawiera ściśle poufne i prawnie chronione informacje. Jeśli są Państwo jej omyłkowym odbiorcą, prosimy o jej usunięcie i niezwłoczne poinformowanie nadawcy. Kopiowanie, ujawnianie lub rozpowszechnianie materiału zawartego w tym e-mailu jest zabronione.';
const DISCLAIMER_EN = 'This email with all its attachments is confidential and may be subject to legal privilege. If it is not intended for you, please notify the sender immediately and delete this e-mail. Any unauthorized copying, disclosure or distribution of the material in this e-mail is strictly forbidden.';

function esc(s='') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function dataUri(mime, buf) {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function ensureCleanSite() {
  await fs.rm(SITE_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(SITE_DIR, 'signatures'), { recursive: true });
  await fs.mkdir(path.join(SITE_DIR, 'icons'), { recursive: true });
  await fs.mkdir(path.join(SITE_DIR, 'photos'), { recursive: true });
  await fs.mkdir(path.join(SITE_DIR, 'media'), { recursive: true });
  await fs.mkdir(path.join(SITE_DIR, 'admin-footer'), { recursive: true });
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

function adminFooterHtml(user, slug, hasPhoto) {
  const photoUrl = hasPhoto ? `${BASE_URL}/photos/${slug}.png` : `${BASE_URL}/media/neutral-avatar.png`;
  const logoUrl = `${BASE_URL}/media/logo.png`;
  const linkedinIcon = `${BASE_URL}/icons/linkedin.png`;
  const facebookIcon = `${BASE_URL}/icons/facebook.png`;
  const youtubeIcon = `${BASE_URL}/icons/youtube.png`;
  const websiteHref = /^https?:\/\//i.test(user.website || '') ? user.website : `https://${user.website}`;

  const titleRow = user.jobTitle
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:${GRAY};">${esc(user.jobTitle)}</div>`
    : '';
  const phoneRow = user.phone
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${GRAY};">Tel: ${esc(user.phone)}</div>`
    : '';
  const linkedin = user.linkedin
    ? `<a href="${esc(user.linkedin)}" style="text-decoration:none;"><img src="${linkedinIcon}" width="28" height="28" alt="LinkedIn" style="display:inline-block;border:0;vertical-align:middle;margin-right:6px;"></a>`
    : `<img src="${linkedinIcon}" width="28" height="28" alt="LinkedIn" style="display:inline-block;border:0;vertical-align:middle;margin-right:6px;">`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Email footer ${esc(user.fullName)}</title></head>
<body style="margin:0;padding:20px;background:#fff;">
<div id="signature" style="max-width:760px;">
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td valign="top" style="width:185px;padding:0 22px 0 0;text-align:center;">
        <img src="${photoUrl}" width="100" height="100" alt="${esc(user.fullName)}" style="display:block;border:0;margin:0 auto 9px auto;">
        <img src="${logoUrl}" width="160" alt="Zdrowa Polska" style="display:block;border:0;margin:0 auto;">
      </td>
      <td valign="top" style="border-left:3px solid ${BLUE};padding:2px 0 0 28px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:27px;font-weight:700;color:#111;">${esc(user.fullName)}</div>
        ${titleRow}
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px;font-weight:700;color:${BLUE};margin:2px 0 7px 0;">${esc(user.company)}</div>
        ${phoneRow}
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${GRAY};">Email: <a href="mailto:${esc(user.email)}" style="color:${BLUE};text-decoration:none;">${esc(user.email)}</a></div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${GRAY};">Strona: <a href="${esc(websiteHref)}" style="color:${BLUE};text-decoration:none;">${esc(user.website)}</a></div>
      </td>
    </tr>
  </table>
  <div style="border-top:1px solid #d9e1e5;margin:10px 0 8px 0;padding-top:7px;">
    ${linkedin}
    <img src="${facebookIcon}" width="28" height="28" alt="Facebook" style="display:inline-block;border:0;vertical-align:middle;margin-right:6px;">
    <img src="${youtubeIcon}" width="28" height="28" alt="YouTube" style="display:inline-block;border:0;vertical-align:middle;">
  </div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;color:#555;max-width:760px;">${esc(DISCLAIMER_PL)}</div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;color:#555;max-width:760px;margin-top:8px;">${esc(DISCLAIMER_EN)}</div>
</div>
</body></html>`;
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

  if (photoBuf) {
    const mask = Buffer.from('<svg width="200" height="200"><circle cx="100" cy="100" r="100" fill="white"/></svg>');
    await sharp(photoBuf)
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(SITE_DIR, 'photos', `${slug}.png`));
  }

  const footerDir = path.join(SITE_DIR, 'admin-footer', slug);
  await fs.mkdir(footerDir, { recursive: true });
  await fs.writeFile(path.join(footerDir, 'index.html'), adminFooterHtml(user, slug, !!photoBuf), 'utf8');
}

async function buildSharedMedia() {
  const logoSvg = await fs.readFile(path.join(ASSETS_DIR, 'logo.svg'));
  await sharp(logoSvg).resize({ width: 320 }).png({ compressionLevel: 9 }).toFile(path.join(SITE_DIR, 'media', 'logo.png'));

  const neutral = await fs.readFile(path.join(ASSETS_DIR, 'neutral-avatar.svg'));
  await sharp(neutral).resize(200, 200).png({ compressionLevel: 9 }).toFile(path.join(SITE_DIR, 'media', 'neutral-avatar.png'));
}

async function buildIcons() {
  for (const name of ['linkedin', 'facebook', 'youtube']) {
    const svg = await fs.readFile(path.join(ASSETS_DIR, 'icons', `${name}.svg`));
    await sharp(svg).resize(56, 56).png().toFile(path.join(SITE_DIR, 'icons', `${name}.png`));
  }
}

await ensureCleanSite();
await buildSharedMedia();
await buildIcons();
const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json')).sort();
for (const file of files) await buildUser(file);
await fs.writeFile(path.join(SITE_DIR, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Zdrowa Polska signature assets</title>', 'utf8');
console.log(`Built ${files.length} signature(s).`);
