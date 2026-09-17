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
  if (code < 200 || code >= 300) throw new Error('GitHub API ' + code + ': ' + text);
  return text ? JSON.parse(text) : {};
}

function githubGetFile_(path) {
  const s = githubSettings_();
  return githubRequest_('get', '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(s.branch), null, true);
}

function githubPutTextIfChanged_(path, text, message) {
  const normalized = String(text).replace(/\r\n/g, '\n');
  const current = githubGetFile_(path);
  if (current && current.content) {
    const existing = Utilities.newBlob(Utilities.base64Decode(String(current.content).replace(/\n/g, ''))).getDataAsString();
    if (existing === normalized) return false;
  }
  const payload = { message: message, branch: githubSettings_().branch, content: Utilities.base64Encode(Utilities.newBlob(normalized, 'text/plain').getBytes()) };
  if (current && current.sha) payload.sha = current.sha;
  githubRequest_('put', '/contents/' + path.split('/').map(encodeURIComponent).join('/'), payload, false);
  return true;
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
