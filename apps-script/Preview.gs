function listPreviewUsers_() {
  const users = [];
  let pageToken;

  do {
    const response = AdminDirectory.Users.list({
      domain: ZP_CONFIG.DOMAIN,
      projection: 'full',
      maxResults: 200,
      pageToken: pageToken
    });

    (response.users || []).forEach(function(raw) {
      const user = getWorkspaceUser_(raw.primaryEmail);
      if (!user.suspended && !user.archived) users.push(user);
    });

    pageToken = response.nextPageToken;
  } while (pageToken);

  users.sort(function(a, b) {
    return String(a.fullName).localeCompare(String(b.fullName), 'pl');
  });

  return users;
}

function previewPhotoUrl_(email) {
  const photo = getUserPhoto_(email);
  if (!photo) return ZP_CONFIG.ASSET_BASE_URL + '/assets/neutral-avatar.png';
  return 'data:' + photo.mimeType + ';base64,' + Utilities.base64Encode(photo.bytes);
}

function previewMeta_(user) {
  const missing = [];
  if (!user.jobTitle) missing.push('brak stanowiska');
  if (!user.phone) missing.push('brak telefonu');
  if (!user.linkedin) missing.push('brak LinkedIn');

  const status = user.enabled ? 'EmailSignature = true' : 'EmailSignature = false';
  const missingText = missing.length ? ' • ' + missing.join(' • ') : '';

  return '<div style="font:12px Arial,sans-serif;color:#666;margin:0 0 14px 0;">' +
    htmlEscape_(user.email) + ' • ' + htmlEscape_(status + missingText) +
    '</div>';
}

function buildAllSignaturesPreview_() {
  const users = listPreviewUsers_();
  let body = '';

  users.forEach(function(user) {
    const photoUrl = previewPhotoUrl_(user.email);
    const signature = buildSignatureHtml_(user, photoUrl);

    body += '<section style="background:#fff;border:1px solid #e2e6e9;border-radius:10px;padding:20px;margin:0 0 22px 0;">' +
      '<div style="font:700 17px Arial,sans-serif;color:#222;margin:0 0 4px 0;">' + htmlEscape_(user.fullName) + '</div>' +
      previewMeta_(user) +
      signature +
      '</section>';
  });

  return '<!doctype html>' +
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Zdrowa Polska — podgląd podpisów</title></head>' +
    '<body style="margin:0;background:#f5f7f8;color:#222;">' +
      '<main style="max-width:900px;margin:0 auto;padding:28px 20px 60px 20px;">' +
        '<h1 style="font:700 24px Arial,sans-serif;margin:0 0 6px 0;">Podgląd podpisów — Zdrowa Polska</h1>' +
        '<div style="font:13px Arial,sans-serif;color:#666;margin-bottom:24px;">' +
          'Podgląd tylko do kontroli. Nie zmienia podpisów innych użytkowników. Liczba użytkowników: ' + users.length +
        '</div>' +
        body +
      '</main>' +
    '</body></html>';
}

function doGet() {
  const viewer = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const allowed = String(ZP_CONFIG.TEST_USER || '').toLowerCase();

  if (viewer && viewer !== allowed) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><div style="font:16px Arial,sans-serif;padding:30px;">Access denied.</div>'
    );
  }

  return HtmlService.createHtmlOutput(buildAllSignaturesPreview_())
    .setTitle('Zdrowa Polska — podgląd podpisów')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
