const ZP_CONFIG = Object.freeze({
  DOMAIN: 'zdrowapolskagroup.pl',
  COMPANY: 'Zdrowa Polska S.A.',
  WEBSITE: 'www.zdrowapolskagroup.pl',

  // TEST MODE: only this account is synchronized.
  TEST_MODE: true,
  TEST_USER: 'dhyk@zdrowapolskagroup.pl',

  CUSTOM_SCHEMA: 'SignatureProfile',
  LINKEDIN_FIELD: 'LinkedIn',
  ENABLED_FIELD: 'EmailSignature',

  // During testing the test user is processed even before the custom flag exists.
  REQUIRE_ENABLED_FLAG: false,

  GITHUB_REPO: 'zdrowa-polska-signatures',
  GITHUB_BRANCH: 'main',

  // Repository paths
  USERS_PATH: 'data/users',
  PHOTOS_PATH: 'data/photos',

  // Used by setupTestUser().
  TEST_LINKEDIN: 'https://www.linkedin.com/in/dhyk/'
});

function getWorkspaceUser_(email) {
  const user = AdminDirectory.Users.get(email, { projection: 'full' });

  const organizations = user.organizations || [];
  const org = organizations.find(x => x.primary) || organizations[0] || {};
  const phones = user.phones || [];
  const phoneObj =
    phones.find(x => x.primary) ||
    phones.find(x => String(x.type || '').toLowerCase() === 'work') ||
    phones.find(x => String(x.type || '').toLowerCase() === 'mobile') ||
    phones[0] || {};

  const custom = (user.customSchemas || {})[ZP_CONFIG.CUSTOM_SCHEMA] || {};
  const linkedin = custom[ZP_CONFIG.LINKEDIN_FIELD] || '';
  const enabledValue = custom[ZP_CONFIG.ENABLED_FIELD];
  const enabled = enabledValue === true || String(enabledValue).toLowerCase() === 'true';

  return {
    email: user.primaryEmail,
    givenName: user.name && user.name.givenName ? user.name.givenName : '',
    familyName: user.name && user.name.familyName ? user.name.familyName : '',
    fullName: user.name && user.name.fullName ? user.name.fullName : user.primaryEmail,
    jobTitle: org.title || '',
    phone: phoneObj.value || '',
    company: ZP_CONFIG.COMPANY,
    website: ZP_CONFIG.WEBSITE,
    linkedin: linkedin,
    enabled: enabled,
    suspended: !!user.suspended,
    archived: !!user.archived
  };
}

function listEligibleUsers_() {
  if (ZP_CONFIG.TEST_MODE) {
    const u = getWorkspaceUser_(ZP_CONFIG.TEST_USER);
    return [u];
  }

  const out = [];
  let pageToken;
  do {
    const response = AdminDirectory.Users.list({
      domain: ZP_CONFIG.DOMAIN,
      projection: 'full',
      maxResults: 200,
      pageToken: pageToken
    });
    (response.users || []).forEach(raw => {
      const u = getWorkspaceUser_(raw.primaryEmail);
      if (!u.suspended && !u.archived) out.push(u);
    });
    pageToken = response.nextPageToken;
  } while (pageToken);

  return out;
}

function getUserPhoto_(email) {
  try {
    const user = AdminDirectory.Users.get(email, { projection: 'full' });
    const photoUrl = user.thumbnailPhotoUrl;
    if (!photoUrl) return null;

    const response = UrlFetchApp.fetch(photoUrl, {
      method: 'get',
      followRedirects: true,
      muteHttpExceptions: true,
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      }
    });

    const code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      console.log('Profile photo fetch failed for ' + email + ': HTTP ' + code);
      return null;
    }

    const blob = response.getBlob();
    const bytes = blob.getBytes();
    const mime = blob.getContentType() || 'image/jpeg';
    let ext = 'jpg';
    if (mime.indexOf('png') >= 0) ext = 'png';
    else if (mime.indexOf('webp') >= 0) ext = 'webp';

    return {
      bytes: bytes,
      mimeType: mime,
      extension: ext
    };
  } catch (e) {
    console.log('No profile photo for ' + email + ': ' + e.message);
    return null;
  }
}

function slugFromEmail_(email) {
  return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

function githubSettings_() {
  const props = PropertiesService.getScriptProperties();
  const owner = props.getProperty('GITHUB_OWNER');
  const token = props.getProperty('GITHUB_TOKEN');

  if (!owner) throw new Error('Script Property GITHUB_OWNER is not set.');
  if (!token) throw new Error('Script Property GITHUB_TOKEN is not set.');

  return {
    owner: owner,
    token: token,
    repo: ZP_CONFIG.GITHUB_REPO,
    branch: ZP_CONFIG.GITHUB_BRANCH
  };
}

function githubRequest_(method, path, body, accept404) {
  const s = githubSettings_();
  const url = 'https://api.github.com/repos/' +
    encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + path;

  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + s.token,
      'Accept': 'application/vnd.github+json',
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
  if (code < 200 || code >= 300) {
    throw new Error('GitHub API ' + code + ': ' + text);
  }
  return text ? JSON.parse(text) : {};
}

function githubGetFile_(path) {
  const s = githubSettings_();
  return githubRequest_(
    'get',
    '/contents/' + path.split('/').map(encodeURIComponent).join('/') +
      '?ref=' + encodeURIComponent(s.branch),
    null,
    true
  );
}

function githubPutTextIfChanged_(path, text, message) {
  const normalized = String(text).replace(/\r\n/g, '\n');
  const current = githubGetFile_(path);

  if (current && current.content) {
    const existing = Utilities.newBlob(
      Utilities.base64Decode(String(current.content).replace(/\n/g, ''))
    ).getDataAsString();
    if (existing === normalized) return false;
  }

  const payload = {
    message: message,
    branch: githubSettings_().branch,
    content: Utilities.base64Encode(Utilities.newBlob(normalized, 'text/plain').getBytes())
  };
  if (current && current.sha) payload.sha = current.sha;

  githubRequest_(
    'put',
    '/contents/' + path.split('/').map(encodeURIComponent).join('/'),
    payload,
    false
  );
  return true;
}

function githubPutBytesIfChanged_(path, bytes, message) {
  const current = githubGetFile_(path);
  const newBase64 = Utilities.base64Encode(bytes);

  if (current && current.content) {
    const oldBase64 = String(current.content).replace(/\s/g, '');
    if (oldBase64 === newBase64) return false;
  }

  const payload = {
    message: message,
    branch: githubSettings_().branch,
    content: newBase64
  };
  if (current && current.sha) payload.sha = current.sha;

  githubRequest_(
    'put',
    '/contents/' + path.split('/').map(encodeURIComponent).join('/'),
    payload,
    false
  );
  return true;
}

function syncSignatures() {
  const users = listEligibleUsers_();
  let updated = 0;

  users.forEach(user => {
    if (user.suspended || user.archived) return;

    const isTestUser =
      ZP_CONFIG.TEST_MODE &&
      user.email.toLowerCase() === ZP_CONFIG.TEST_USER.toLowerCase();

    if (ZP_CONFIG.REQUIRE_ENABLED_FLAG && !user.enabled && !isTestUser) return;

    const slug = slugFromEmail_(user.email);
    const photo = getUserPhoto_(user.email);

    let photoFile = '';
    if (photo) {
      photoFile = slug + '.' + photo.extension;
      const changed = githubPutBytesIfChanged_(
        ZP_CONFIG.PHOTOS_PATH + '/' + photoFile,
        photo.bytes,
        'Update Workspace photo for ' + user.email
      );
      if (changed) updated++;
    }

    const payload = {
      email: user.email,
      givenName: user.givenName,
      familyName: user.familyName,
      fullName: user.fullName,
      jobTitle: user.jobTitle || '',
      phone: user.phone || '',
      company: user.company,
      website: user.website,
      linkedin: user.linkedin || '',
      photoFile: photoFile,
      generatedAt: new Date().toISOString()
    };

    const changed = githubPutTextIfChanged_(
      ZP_CONFIG.USERS_PATH + '/' + slug + '.json',
      JSON.stringify(payload, null, 2) + '\n',
      'Update signature data for ' + user.email
    );
    if (changed) updated++;
  });

  console.log('Signature sync complete. Changed files: ' + updated);
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
        {
          fieldName: ZP_CONFIG.LINKEDIN_FIELD,
          fieldType: 'STRING',
          multiValued: false,
          readAccessType: 'ADMINS_AND_SELF'
        },
        {
          fieldName: ZP_CONFIG.ENABLED_FIELD,
          fieldType: 'BOOL',
          multiValued: false,
          readAccessType: 'ADMINS_AND_SELF'
        }
      ]
    }, 'my_customer');
  }

  console.log('Custom schema ready: ' + name);
}

function setupTestUser() {
  const patch = {
    customSchemas: {}
  };
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA] = {};
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA][ZP_CONFIG.LINKEDIN_FIELD] =
    ZP_CONFIG.TEST_LINKEDIN;
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA][ZP_CONFIG.ENABLED_FIELD] = true;

  AdminDirectory.Users.patch(patch, ZP_CONFIG.TEST_USER);
  console.log('Test user custom fields updated.');
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncSignatures')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncSignatures')
    .timeBased()
    .everyHours(1)
    .create();

  console.log('Hourly trigger installed.');
}

function firstTimeSetup() {
  setupSignatureSchema();
  setupTestUser();
  setupHourlyTrigger();
  syncSignatures();
}
