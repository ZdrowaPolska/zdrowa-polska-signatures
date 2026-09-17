function getWorkspaceUser_(email) {
  const user = AdminDirectory.Users.get(email, { projection: 'full' });
  const organizations = user.organizations || [];
  const org = organizations.find(x => x.primary) || organizations[0] || {};
  const phones = user.phones || [];
  const phoneObj = phones.find(x => x.primary) || phones.find(x => String(x.type || '').toLowerCase() === 'work') || phones.find(x => String(x.type || '').toLowerCase() === 'mobile') || phones[0] || {};
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
  if (ZP_CONFIG.TEST_MODE) return [getWorkspaceUser_(ZP_CONFIG.TEST_USER)];
  const out = [];
  let pageToken;
  do {
    const response = AdminDirectory.Users.list({domain: ZP_CONFIG.DOMAIN, projection: 'full', maxResults: 200, pageToken: pageToken});
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
    const photo = AdminDirectory.Users.Photos.get(email);
    if (!photo || !photo.photoData) return null;
    const bytes = Utilities.base64DecodeWebSafe(photo.photoData);
    const mime = photo.mimeType || 'image/jpeg';
    let ext = 'jpg';
    if (mime.indexOf('png') >= 0) ext = 'png';
    else if (mime.indexOf('webp') >= 0) ext = 'webp';
    return {bytes: bytes, mimeType: mime, extension: ext};
  } catch (e) {
    console.log('No profile photo for ' + email + ': ' + e.message);
    return null;
  }
}

function slugFromEmail_(email) {
  return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}
