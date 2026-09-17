function syncSignatures() {
  const users = listEligibleUsers_();
  let updated = 0;

  users.forEach(user => {
    if (user.suspended || user.archived) return;
    const isTestUser = ZP_CONFIG.TEST_MODE && user.email.toLowerCase() === ZP_CONFIG.TEST_USER.toLowerCase();
    if (ZP_CONFIG.REQUIRE_ENABLED_FLAG && !user.enabled && !isTestUser) return;

    const slug = slugFromEmail_(user.email);
    const photo = getUserPhoto_(user.email);
    let photoFile = '';

    if (photo) {
      photoFile = slug + '.' + photo.extension;
      const changed = githubPutBytesIfChanged_(ZP_CONFIG.PHOTOS_PATH + '/' + photoFile, photo.bytes, 'Update Workspace photo for ' + user.email);
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

    const changed = githubPutTextIfChanged_(ZP_CONFIG.USERS_PATH + '/' + slug + '.json', JSON.stringify(payload, null, 2) + '\n', 'Update signature data for ' + user.email);
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
        { fieldName: ZP_CONFIG.LINKEDIN_FIELD, fieldType: 'STRING', multiValued: false, readAccessType: 'ADMINS_AND_SELF' },
        { fieldName: ZP_CONFIG.ENABLED_FIELD, fieldType: 'BOOL', multiValued: false, readAccessType: 'ADMINS_AND_SELF' }
      ]
    }, 'my_customer');
  }
  console.log('Custom schema ready: ' + name);
}

function setupTestUser() {
  const patch = { customSchemas: {} };
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA] = {};
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA][ZP_CONFIG.LINKEDIN_FIELD] = ZP_CONFIG.TEST_LINKEDIN;
  patch.customSchemas[ZP_CONFIG.CUSTOM_SCHEMA][ZP_CONFIG.ENABLED_FIELD] = true;
  AdminDirectory.Users.patch(patch, ZP_CONFIG.TEST_USER);
  console.log('Test user custom fields updated.');
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncSignatures').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncSignatures').timeBased().everyHours(1).create();
  console.log('Hourly trigger installed.');
}

function firstTimeSetup() {
  setupSignatureSchema();
  setupTestUser();
  setupHourlyTrigger();
  syncSignatures();
}
