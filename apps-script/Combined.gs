const ZP_CONFIG = Object.freeze({
  DOMAIN: 'zdrowapolskagroup.pl',
  COMPANY: 'Zdrowa Polska S.A.',
  WEBSITE: 'www.zdrowapolskagroup.pl',

  TEST_MODE: true,
  TEST_USER: 'dhyk@zdrowapolskagroup.pl',

  CUSTOM_SCHEMA: 'SignatureProfile',
  LINKEDIN_FIELD: 'LinkedIn',
  ENABLED_FIELD: 'EmailSignature',

  GITHUB_REPO: 'zdrowa-polska-signatures',
  GITHUB_BRANCH: 'main',
  PHOTOS_PATH: 'data/photos',
  ASSET_BASE_URL: 'https://zdrowapolska.github.io/zdrowa-polska-signatures',

  TEST_LINKEDIN: 'https://www.linkedin.com/in/dhyk/',
  FACEBOOK_URL: '',
  YOUTUBE_URL: '',

  GMAIL_SCOPE: 'https://www.googleapis.com/auth/gmail.settings.basic'
});

const DISCLAIMER_PL = 'Niniejsza wiadomość wraz z załącznikami zawiera ściśle poufne i prawnie chronione informacje. Jeśli są Państwo jej omyłkowym odbiorcą, prosimy o jej usunięcie i niezwłoczne poinformowanie nadawcy. Kopiowanie, ujawnianie lub rozpowszechnianie materiału zawartego w tym e-mailu jest zabronione.';
const DISCLAIMER_EN = 'This email with all its attachments is confidential and may be subject to legal privilege. If it is not intended for you, please notify the sender immediately and delete this e-mail. Any unauthorized copying, disclosure or distribution of the material in this e-mail is strictly forbidden.';

function htmlEscape_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugFromEmail_(email) {
  return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

function getWorkspaceUser_(email) {
  const user = AdminDirectory.Users.get(email, { projection: 'full' });
  const organizations = user.organizations || [];
  const org = organizations.find(function(x) { return x.primary; }) || organizations[0] || {};
  const phones = user.phones || [];
  const phoneObj =
    phones.find(function(x) { return x.primary; }) ||
    phones.find(function(x) { return String(x.type || '').toLowerCase() === 'work'; }) ||
    phones.find(function(x) { return String(x.type || '').toLowerCase() === 'mobile'; }) ||
    phones[0] || {};

  const custom = (user.customSchemas || {})[ZP_CONFIG.CUSTOM_SCHEMA] || {};
  const linkedin = custom[ZP_CONFIG.LINKEDIN_FIELD] || '';
  const enabledValue = custom[ZP_CONFIG.ENABLED_FIELD];
  const enabled = enabledValue === true || String(enabledValue).toLowerCase() === 'true';

  return {
    email: user.primaryEmail,
    fullName: user.name && user.name.fullName ? user.name.fullName : user.primaryEmail,
    jobTitle: org.title || '',
    phone: phoneObj.value || '',
    linkedin: linkedin,
    enabled: enabled,
    suspended: !!user.suspended,
    archived: !!user.archived
  };
}

function listEligibleUsers_() {
  if (ZP_CONFIG.TEST_MODE) return [getWorkspaceUser_(ZP_CONFIG.TEST_USER)];

  const out = [];
  let pageToken;
  do {
    const response = AdminDirectory.Users.list({
      domain: ZP_CONFIG.DOMAIN,
      projection: 'full',
      maxResults: 200,
      pageToken: pageToken
    });
    (response.users || []).forEach(function(raw) {
      const u = getWorkspaceUser_(raw.primaryEmail);
      if (!u.suspended && !u.archived && u.enabled) out.push(u);
    });
    pageToken = response.nextPageToken;
  } while (pageToken);
  return out;
}

function getUserPhoto_(email) {
  try {
    const url = 'https://admin.googleapis.com/admin/directory/v1/users/' +
      encodeURIComponent(email) + '/photos/thumbnail';
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        Accept: 'application/json'
      }
    });

    const code = response.getResponseCode();
    if (code === 404) return null;
    if (code < 200 || code >= 300) {
      throw new Error('Directory API HTTP ' + code + ': ' + response.getContentText());
    }

    const photo = JSON.parse(response.getContentText());
    if (!photo || !photo.photoData) return null;

    let encoded = String(photo.photoData).replace(/\s/g, '');
    while (encoded.length % 4 !== 0) encoded += '=';
    const bytes = Utilities.base64DecodeWebSafe(encoded);
    if (!bytes || !bytes.length) return null;

    const u = function(i) { return ((bytes[i] || 0) + 256) % 256; };
    let info = { mimeType: 'image/jpeg', extension: 'jpg' };

    if (bytes.length >= 8 && u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4E && u(3) === 0x47 && u(4) === 0x0D && u(5) === 0x0A && u(6) === 0x1A && u(7) === 0x0A) {
      info = { mimeType: 'image/png', extension: 'png' };
    } else if (bytes.length >= 3 && u(0) === 0xFF && u(1) === 0xD8 && u(2) === 0xFF) {
      info = { mimeType: 'image/jpeg', extension: 'jpg' };
    } else if (bytes.length >= 12 && u(0) === 0x52 && u(1) === 0x49 && u(2) === 0x46 && u(3) === 0x46 && u(8) === 0x57 && u(9) === 0x45 && u(10) === 0x42 && u(11) === 0x50) {
      info = { mimeType: 'image/webp', extension: 'webp' };
    }

    return { bytes: bytes, mimeType: info.mimeType, extension: info.extension };
  } catch (e) {
    console.log('Profile photo read failed for ' + email + ': ' + e.message);
    return null;
  }
}

function githubSettings_() {
  const props = PropertiesService.getScriptProperties();
  const owner = props.getProperty('GITHUB_OWNER');
  const token = props.getProperty('GITHUB_TOKEN');
  if (!owner) throw new Error('Script Property GITHUB_OWNER is not set.');
  if (!token) throw new Error('Script Property GITHUB_TOKEN is not set.');
  return { owner: owner, token: token, repo: ZP_CONFIG.GITHUB_REPO, branch: ZP_CONFIG.GITHUB_BRANCH };
}

function githubRequest_(method, path, body, accept404) {
  const s = githubSettings_();
  const url = 'https://api.github.com/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + path;
  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + s.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (body !== undefined && body !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (accept404 && code === 404) return null;
  if (code < 200 || code >= 300) throw new Error('GitHub API ' + code + ': ' + text);
  return text ? JSON.parse(text) : {};
}

function githubGetFile_(path) {
  const s = githubSettings_();
  return githubRequest_(
    'get',
    '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(s.branch),
    null,
    true
  );
}

function githubPutBytesIfChanged_(path, bytes, message) {
  const current = githubGetFile_(path);
  const newBase64 = Utilities.base64Encode(bytes);
  if (current && current.content) {
    const oldBase64 = String(current.content).replace(/\s/g, '');
    if (oldBase64 === newBase64) return false;
  }
  const payload = { message: message, branch: githubSettings_().branch, content: newBase64 };
  if (current && current.sha) payload.sha = current.sha;
  githubRequest_('put', '/contents/' + path.split('/').map(encodeURIComponent).join('/'), payload, false);
  return true;
}

function githubDeleteIfExists_(path, message) {
  const current = githubGetFile_(path);
  if (!current || !current.sha) return false;
  githubRequest_(
    'delete',
    '/contents/' + path.split('/').map(encodeURIComponent).join('/'),
    { message: message, branch: githubSettings_().branch, sha: current.sha },
    false
  );
  return true;
}

function sha256Short_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function(b) {
    const v = (b + 256) % 256;
    return ('0' + v.toString(16)).slice(-2);
  }).join('').slice(0, 16);
}

function syncPhoto_(user) {
  const photo = getUserPhoto_(user.email);
  if (!photo) return ZP_CONFIG.ASSET_BASE_URL + '/assets/neutral-avatar.png';

  const slug = slugFromEmail_(user.email);
  const filename = slug + '.' + photo.extension;
  githubPutBytesIfChanged_(
    ZP_CONFIG.PHOTOS_PATH + '/' + filename,
    photo.bytes,
    'Update Workspace photo for ' + user.email
  );

  ['jpg', 'png', 'webp'].forEach(function(ext) {
    if (ext !== photo.extension) {
      githubDeleteIfExists_(ZP_CONFIG.PHOTOS_PATH + '/' + slug + '.' + ext, 'Remove obsolete photo format for ' + user.email);
    }
  });

  return ZP_CONFIG.ASSET_BASE_URL + '/photos/' + filename + '?v=' + sha256Short_(photo.bytes);
}

function socialIcon_(name, url, alt) {
  const iconUrl = ZP_CONFIG.ASSET_BASE_URL + '/assets/icons/' + name + '.png';
  const img = '<img src="' + iconUrl + '" width="24" height="24" alt="' + htmlEscape_(alt) + '" style="display:inline-block;border:0;vertical-align:middle;margin-right:6px;">';
  return url ? '<a href="' + htmlEscape_(url) + '" style="text-decoration:none;">' + img + '</a>' : img;
}

function buildSignatureHtml_(user, photoUrl) {
  const logoUrl = ZP_CONFIG.ASSET_BASE_URL + '/assets/logo.png';
  const websiteHref = 'https://' + ZP_CONFIG.WEBSITE;
  const phoneRow = user.phone
    ? '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#555;">Tel: <a href="tel:' + htmlEscape_(String(user.phone).replace(/[^+\d]/g, '')) + '" style="color:#555;text-decoration:none;">' + htmlEscape_(user.phone) + '</a></div>'
    : '';
  const titleRow = user.jobTitle
    ? '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:19px;color:#555;">' + htmlEscape_(user.jobTitle) + '</div>'
    : '';

  const social =
    socialIcon_('linkedin', user.linkedin || '', 'LinkedIn') +
    socialIcon_('facebook', ZP_CONFIG.FACEBOOK_URL, 'Facebook') +
    socialIcon_('youtube', ZP_CONFIG.YOUTUBE_URL, 'YouTube');

  return '' +
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;max-width:680px;">' +
      '<tr>' +
        '<td valign="top" style="width:170px;padding:0 20px 0 0;text-align:center;">' +
          '<img src="' + htmlEscape_(photoUrl) + '" width="96" height="96" alt="' + htmlEscape_(user.fullName) + '" style="display:block;width:96px;height:96px;border:0;border-radius:48px;margin:0 auto 8px auto;">' +
          '<img src="' + logoUrl + '" width="145" alt="Zdrowa Polska" style="display:block;width:145px;height:auto;border:0;margin:0 auto;">' +
        '</td>' +
        '<td valign="top" style="border-left:3px solid #0B6FA4;padding:1px 0 0 20px;">' +
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:25px;font-weight:700;color:#111;">' + htmlEscape_(user.fullName) + '</div>' +
          titleRow +
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:#0B6FA4;margin:2px 0 6px 0;">' + ZP_CONFIG.COMPANY + '</div>' +
          phoneRow +
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#555;">Email: <a href="mailto:' + htmlEscape_(user.email) + '" style="color:#0B6FA4;text-decoration:none;">' + htmlEscape_(user.email) + '</a></div>' +
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#555;">Strona: <a href="' + websiteHref + '" style="color:#0B6FA4;text-decoration:none;">' + ZP_CONFIG.WEBSITE + '</a></div>' +
        '</td>' +
      '</tr>' +
      '<tr><td colspan="2" style="padding-top:9px;border-bottom:1px solid #d9e1e5;"></td></tr>' +
      '<tr><td colspan="2" style="padding-top:7px;">' + social + '</td></tr>' +
      '<tr><td colspan="2" style="padding-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;color:#666;">' + htmlEscape_(DISCLAIMER_PL) + '</td></tr>' +
      '<tr><td colspan="2" style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;color:#666;">' + htmlEscape_(DISCLAIMER_EN) + '</td></tr>' +
    '</table>';
}

function base64UrlText_(text) {
  return Utilities.base64EncodeWebSafe(String(text)).replace(/=+$/g, '');
}

function base64UrlBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function serviceAccountSettings_() {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  let privateKey = props.getProperty('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  if (!email) throw new Error('Script Property GOOGLE_SERVICE_ACCOUNT_EMAIL is not set.');
  if (!privateKey) throw new Error('Script Property GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not set.');
  privateKey = privateKey.replace(/\\n/g, '\n');
  return { email: email, privateKey: privateKey };
}

function delegatedAccessToken_(subjectEmail) {
  const sa = serviceAccountSettings_();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.email,
    sub: subjectEmail,
    scope: ZP_CONFIG.GMAIL_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = base64UrlText_(JSON.stringify(header)) + '.' + base64UrlText_(JSON.stringify(claims));
  const signature = Utilities.computeRsaSha256Signature(unsigned, sa.privateKey);
  const assertion = unsigned + '.' + base64UrlBytes_(signature);

  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    }
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('Google OAuth token error ' + code + ': ' + text);
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error('Google OAuth response did not contain an access token.');
  return data.access_token;
}

function setGmailSignature_(email, html) {
  const token = delegatedAccessToken_(email);
  const url = 'https://gmail.googleapis.com/gmail/v1/users/' + encodeURIComponent(email) + '/settings/sendAs/' + encodeURIComponent(email);
  const response = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ signature: html })
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Gmail API HTTP ' + code + ' for ' + email + ': ' + response.getContentText());
  }
}

function syncSignatures() {
  const users = listEligibleUsers_();
  let updated = 0;

  users.forEach(function(user) {
    if (user.suspended || user.archived) return;
    if (!ZP_CONFIG.TEST_MODE && !user.enabled) return;

    const photoUrl = syncPhoto_(user);
    const html = buildSignatureHtml_(user, photoUrl);
    setGmailSignature_(user.email, html);
    updated++;
  });

  console.log('Gmail signature sync complete. Updated users: ' + updated);
}

function setupSignatureSchema() {
  const name = ZP_CONFIG.CUSTOM_SCHEMA;
  let exists = false;
  try {
    AdminDirectory.Schemas.get('my_customer', name);
    exists = true;
  } catch (e) {
    exists = false;
  }

  if (!exists) {
    AdminDirectory.Schemas.insert({
      schemaName: name,
      displayName: 'Email Signature',
      fields: [
        { fieldName: ZP_CONFIG.LINKEDIN_FIELD, fieldType: 'STRING', multiValued: false, readAccessType: 'ADMINS_AND_SELF' },
        { fieldName: ZP_CONFIG.ENABLED_FIELD, fieldType: 'BOOL', multiValued: false, readAccessType: 'ADMINS_AND_SELF' }
      ]
    }, 'my_customer');
  }
}

function setupTestUser() {
  const patch = { customSchemas: {} };
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA] = {};
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA][ZP_CONFIG.LINKEDIN_FIELD] = ZP_CONFIG.TEST_LINKEDIN;
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA][ZP_CONFIG.ENABLED_FIELD] = true;
  AdminDirectory.Users.patch(patch, ZP_CONFIG.TEST_USER);
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'syncSignatures'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncSignatures').timeBased().everyHours(1).create();
}

function firstTimeSetup() {
  setupSignatureSchema();
  setupTestUser();
  setupHourlyTrigger();
  syncSignatures();
}
