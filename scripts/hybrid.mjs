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
    ? `<text x="205" y="53" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="${GRAY}">${esc(user.jobTitle)}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="208" viewBox="0 0 600 104">
  <rect width="600" height="104" fill="#ffffff"/>
  <defs><clipPath id="p"><circle cx="77" cy="42" r="39"/></clipPath></defs>
  ${photo
    ? `<image href="${photo}" x="38" y="3" width="78" height="78" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/>`
    : `<circle cx="77" cy="42" r="39" fill="#EEF3F3"/><circle cx="77" cy="33" r="14" fill="#9BAEAF"/><path d="M50 72c4-18 14-28 27-28s23 10 27 28" fill="#9BAEAF"/>`
  }
  <image href="${logo}" x="25" y="78" width="108" height="24" preserveAspectRatio="xMidYMid meet"/>
  <rect x="175" y="4" width="2.5" height="96" fill="${BLUE}"/>
  <text x="205" y="28" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#111111">${esc(user.fullName)}</text>
  ${job}
  <text x="205" y="81" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" fill="${BLUE}">${esc(user.company)}</text>
</svg>`;
}

function contactRowSvg(label, value, valueColor=BLUE) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="40" viewBox="0 0 600 20">
  <rect width="600" height="20" fill="#ffffff"/>
  <text x="205" y="14.5" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="${GRAY}">${esc(label)} <tspan fill="${valueColor}">${esc(value)}</tspan></text>
</svg>`;
}

function pageHtml(user, slug) {
  const websiteHref = /^https?:\/\//i.test(user.website || '') ? user.website : `https://${user.website}`;
  const coreUrl = `${BASE_URL}/hybrid/${slug}/core.png`;
  const phoneUrl = `${BASE_URL}/hybrid/${slug}/phone.png`;
  const emailUrl = `${BASE_URL}/hybrid/${slug}/email.png`;
  const websiteUrl = `${BASE_URL}/hybrid/${slug}/website.png`;
  const linkedinIcon = `${BASE_URL}/icons/linkedin.png`;
  const facebookIcon = `${BASE_URL}/icons/facebook.png`;
  const youtubeIcon = `${BASE_URL}/icons/youtube.png`;
  const linkedin = user.linkedin
    ? `<a href="${esc(user.linkedin)}"><img src="${linkedinIcon}" width="28" height="28" alt="LinkedIn" style="border:0;vertical-align:middle;margin-right:6px;"></a>`
    : `<img src="${linkedinIcon}" width="28" height="28" alt="LinkedIn" style="border:0;vertical-align:middle;margin-right:6px;">`;
  const phoneRow = user.phone
    ? `<div><a href="tel:${esc(String(user.phone).replace(/[^+\d]/g,''))}" style="text-decoration:none;"><img src="${phoneUrl}" width="600" height="20" alt="Tel: ${esc(user.phone)}" style="display:block;border:0;"></a></div>`
    : '';

  const signature = `
<div id="signature" style="font-family:Arial,Helvetica,sans-serif;color:${GRAY};max-width:650px;">
  <div><img src="${coreUrl}" width="600" height="104" alt="${esc(user.fullName)}" style="display:block;border:0;"></div>
  ${phoneRow}
  <div><a href="mailto:${esc(user.email)}"><img src="${emailUrl}" width="600" height="20" alt="Email: ${esc(user.email)}" style="display:block;border:0;"></a></div>
  <div><a href="${esc(websiteHref)}"><img src="${websiteUrl}" width="600" height="20" alt="Strona: ${esc(user.website)}" style="display:block;border:0;"></a></div>
  <div style="border-top:1px solid #d9e1e5;margin-top:6px;padding-top:6px;">${linkedin}<img src="${facebookIcon}" width="28" height="28" alt="Facebook" style="border:0;vertical-align:middle;margin-right:6px;"><img src="${youtubeIcon}" width="28" height="28" alt="YouTube" style="border:0;vertical-align:middle;"></div>
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
  const core = await coreSvg(user, photoBuf, photoMime, logoBuf);
  const phone = user.phone ? contactRowSvg('Tel:', user.phone, GRAY) : null;
  const email = contactRowSvg('Email:', user.email);
  const website = contactRowSvg('Strona:', user.website);

  // Google Admin Append footer displays linked images at their intrinsic pixel size.
  // Render at 2x for antialiasing, then downsample to the exact intended display size.
  await sharp(Buffer.from(core)).resize(600, 104, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(path.join(dir, 'core.png'));
  if (phone) await sharp(Buffer.from(phone)).resize(600, 20, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(path.join(dir, 'phone.png'));
  await sharp(Buffer.from(email)).resize(600, 20, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(path.join(dir, 'email.png'));
  await sharp(Buffer.from(website)).resize(600, 20, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(path.join(dir, 'website.png'));
  await fs.writeFile(path.join(dir, 'index.html'), pageHtml(user, slug), 'utf8');
}

console.log(`Built ${files.length} hybrid footer(s).`);
