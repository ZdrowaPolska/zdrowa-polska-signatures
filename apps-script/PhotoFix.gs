function getUserPhotoV2_(email) {
  try {
    const url = 'https://admin.googleapis.com/admin/directory/v1/users/' +
      encodeURIComponent(email) + '/photos/thumbnail';

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'Accept': 'application/json'
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

    const u = i => ((bytes[i] || 0) + 256) % 256;
    let info = { mimeType: 'image/jpeg', extension: 'jpg' };

    if (bytes.length >= 8 &&
        u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4E && u(3) === 0x47 &&
        u(4) === 0x0D && u(5) === 0x0A && u(6) === 0x1A && u(7) === 0x0A) {
      info = { mimeType: 'image/png', extension: 'png' };
    } else if (bytes.length >= 3 && u(0) === 0xFF && u(1) === 0xD8 && u(2) === 0xFF) {
      info = { mimeType: 'image/jpeg', extension: 'jpg' };
    } else if (bytes.length >= 6 &&
               u(0) === 0x47 && u(1) === 0x49 && u(2) === 0x46 &&
               u(3) === 0x38 && (u(4) === 0x37 || u(4) === 0x39) && u(5) === 0x61) {
      info = { mimeType: 'image/gif', extension: 'gif' };
    } else if (bytes.length >= 12 &&
               u(0) === 0x52 && u(1) === 0x49 && u(2) === 0x46 && u(3) === 0x46 &&
               u(8) === 0x57 && u(9) === 0x45 && u(10) === 0x42 && u(11) === 0x50) {
      info = { mimeType: 'image/webp', extension: 'webp' };
    }

    return {
      bytes: bytes,
      mimeType: info.mimeType,
      extension: info.extension
    };
  } catch (e) {
    console.log('Profile photo read failed for ' + email + ': ' + e.message);
    return null;
  }
}
