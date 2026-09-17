function decodeGooglePhotoData_(value) {
  let s = String(value || '').replace(/\s/g, '');
  if (!s) return [];

  // Google Directory uses a modified web-safe Base64 alphabet:
  // '-' for '+', '_' for '/', '*' and '.' for padding.
  s = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[*.]/g, '=')
    .replace(/=+$/g, '');

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < s.length; i++) {
    const value6 = alphabet.indexOf(s.charAt(i));
    if (value6 < 0) throw new Error('Unexpected character in profile photo data.');

    buffer = (buffer << 6) | value6;
    bits += 6;

    while (bits >= 8) {
      bits -= 8;
      const b = (buffer >> bits) & 0xff;
      // Apps Script byte arrays use signed byte values.
      out.push(b > 127 ? b - 256 : b);
      buffer = bits ? (buffer & ((1 << bits) - 1)) : 0;
    }
  }

  return out;
}

function getUserPhotoV2_(email) {
  try {
    const photo = AdminDirectory.Users.Photos.get(email);
    if (!photo || !photo.photoData) return null;

    const bytes = decodeGooglePhotoData_(photo.photoData);
    if (!bytes.length) return null;

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
