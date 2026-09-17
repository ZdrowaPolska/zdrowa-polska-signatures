import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'users');
const PHOTO_DIR = path.join(ROOT, 'data', 'photos');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SITE_DIR = path.join(ROOT, 'site');
const OUT_DIR = path.join(SITE_DIR, 'hybrid');
const BASE_URL = 'https://zdrowapolska.github.io/zdrowa-polska-signatures';
const BLUE = '#0B6FA4';
const GRAY = '#555555';

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

async function readOptional(file) {
  try { return await fs.readFile(file); } catch { return null; }
}

function mimeFromName(name='') {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function coreSvg(user, photoBuf, photoMime, logoBuf) {
  const photo = photoBuf ? dataUri(photoMime, photoBuf) : null;
  const logo = dataUri('image/svg+xml', logoBuf);
  const job = user.jobTitle
    ? `<text x="205" y="55" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="${GRAY}">${esc(user.jobTitle)}</text>`
    : '';
  const phone = user.phone
    ? `<text x="205" y="120" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="${GRAY}">Tel: ${esc(user.phone)}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 600 150">
  <rect width="600" height="150" fill="#ffffff"/>
  <defs><clipPath id="p"><circle cx="77" cy="45" r="42"/></clipPath></defs>
  ${photo
    ? `<image href="${photo}" x="35" y="3" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/>`
    : `<circle cx="77" cy="45" r="42" fill="#EEF3F3"/><circle cx="77" cy="35" r="15" fill="#9BAEAF"/><path d="M47 77c4-20 15-31 30-31s26 11 30 31" fill="#9BAEAF"/>`
  }
  <image href="${logo}" x="12" y="94" width="140" height="48" preserveAspectRatio="xMidYMid meet"/>
  <rect x="175" y="5" width="2.5" height="140" fill="${BLUE}"/>
  <text x="205" y="30" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#111111">${esc(user.fullName)}</text>
  ${job}
  <text x="205" y="84" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" fill="${BLUE}">${esc(user.company)}</text>
  ${phone}
</svg>`;
}

function pageHtml(user, slug) {
  const websiteHref = /^https?:\/\//i.test(user.website || '') ? user.website : `https://${user.website}`;
  const coreUrl = `${BASE_URL}/hybrid/${slug}/core.png`;
  const spacerUrl = `${BASE_URL}/hybrid/spacer.png`;
  const linkedinIcon = `${BASE_URL}/icons/linkedin.png`;
  const facebookIcon = `${BASE_URL}/icons/facebook.png`;
  const youtubeIcon = `${BASE_URL}/icons/youtube.png`;
  const linkedin = user.linkedin
    ? `<a href="${esc(user.linkedin)}"><img src="${linkedinIcon}" width="28" height="28" alt="LinkedIn" style="border:0;vertical-align:middle;margin-right:6px;"></a>`
    : `<img src="${linkedinIcon}" width="28" height="28" alt="LinkedIn" style="border:0;vertical-align:middle;margin-right:6px;">`;

  const signature = `
<div id="signature" style="font-family:Arial,Helvetica,sans-serif;color:${GRAY};max-width:650px;">
  <div><img src="${coreUrl}" width="600" height="150" alt="${esc(user.fullName)}" style="display:block;border:0;max-width:100%;height:auto;"></div>
  <div style="font-size:14px;line-height:20px;white-space:nowrap;"><img src="${spacerUrl}" width="328" height="1" alt="" style="display:inline-block;border:0;vertical-align:middle;width:328px;height:1px;">Email: <a href="mailto:${esc(user.email)}" style="color:${BLUE};text-decoration:none;">${esc(user.email)}</a></div>
  <div style="font-size:14px;line-height:20px;white-space:nowrap;"><img src="${spacerUrl}" width="328" height="1" alt="" style="display:inline-block;border:0;vertical-align:middle;width:328px;height:1px;">Strona: <a href="${esc(websiteHref)}" style="color:${BLUE};text-decoration:none;">${esc(user.website)}</a></div>
  <div style="border-top:1px solid #d9e1e5;margin-top:8px;padding-top:7px;">${linkedin}<img src="${facebookIcon}" width="28" height="28" alt="Facebook" style="border:0;vertical-align:middle;margin-right:6px;"><img src="${youtubeIcon}" width="28" height="28" alt="YouTube" style="border:0;vertical-align:middle;"></div>
  <div style="font-size:11px;line-height:15px;color:#555;margin-top:7px;">${esc(DISCLAIMER_PL)}</div>
  <div style="font-size:11px;line-height:15px;color:#555;margin-top:7px;">${esc(DISCLAIMER_EN)}</div>
</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Hybrid footer ${esc(user.fullName)}</title></head>
<body style="margin:20px;background:#fff;">
<button id="copy" style="font:600 14px Arial,sans-serif;padding:9px 14px;border:0;border-radius:5px;background:${BLUE};color:#fff;cursor:pointer;margin-bottom:16px;">Kopiuj podpis</button>
<span id="status" style="font:14px Arial,sans-serif;margin-left:10px;color:#2a7a2a;"></span>
${signature}
<script>
const btn=document.getElementById('copy');
btn.addEventListener('click',async()=>{
 const el=document.getElementById('signature');
 const html=el.outerHTML;
 const plain=el.innerText;
 try {
   await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);
   document.getElementById('status').textContent='Skopiowano';
 } catch(e) {
   const r=document.createRange(); r.selectNode(el); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges(); document.getElementById('status').textContent='Skopiowano';
 }
});
</script></body></html>`;
}

await fs.mkdir(OUT_DIR, { recursive: true });
await sharp({ create: { width: 656, height: 2, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
  .png()
  .toFile(path.join(OUT_DIR, 'spacer.png'));

const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json')).sort();
const logoBuf = await fs.readFile(path.join(ASSETS_DIR, 'logo.svg'));

for (const file of files) {
  const slug = path.basename(file, '.json');
  const user = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'));
  let photoBuf = null, photoMime = null;
  if (user.photoFile) {
    photoBuf = await readOptional(path.join(PHOTO_DIR, user.photoFile));
    if (photoBuf) photoMime = mimeFromName(user.photoFile);
  }
  const dir = path.join(OUT_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const svg = await coreSvg(user, photoBuf, photoMime, logoBuf);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(dir, 'core.png'));
  await fs.writeFile(path.join(dir, 'index.html'), pageHtml(user, slug), 'utf8');
}

console.log(`Built ${files.length} hybrid footer(s).`);
