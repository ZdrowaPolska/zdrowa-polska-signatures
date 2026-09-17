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

    const rawMime = String(photo.mimeType || 'JPEG').toUpperCase();
    const mimeMap = {
      'JPEG': {mimeType: 'image/jpeg', extension: 'jpg'},
      'JPG': {mimeType: 'image/jpeg', extension: 'jpg'},
      'PNG': {mimeType: 'image/png', extension: 'png'},
      'GIF': {mimeType: 'image/gif', extension: 'gif'},
      'BMP': {mimeType: 'image/bmp', extension: 'bmp'},
      'TIFF': {mimeType: 'image/tiff', extension: 'tiff'},
      'WEBP': {mimeType: 'image/webp', extension: 'webp'}
    };
    const info = mimeMap[rawMime] || {mimeType: 'image/jpeg', extension: 'jpg'};

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
