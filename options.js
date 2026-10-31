const urlEl = document.getElementById('webhookUrl');
const keyEl = document.getElementById('key');
const statusEl = document.getElementById('status');

function show(ok, text) {
  statusEl.className = ok ? 'ok' : 'err';
  statusEl.textContent = text;
}

chrome.storage.local.get(['webhookUrl', 'key']).then(({ webhookUrl, key }) => {
  urlEl.value = webhookUrl ?? '';
  keyEl.value = key ?? '';
});

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  let url;
  try {
    url = new URL(urlEl.value.trim());
  } catch {
    return show(false, 'URL の形式が正しくありません');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return show(false, 'http(s) の URL を指定してください');
  }
  const granted = await chrome.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] });
  if (!granted) return show(false, 'アクセス許可が拒否されたため保存しませんでした');
  await chrome.storage.local.set({ webhookUrl: url.href, key: keyEl.value.trim() });
  show(true, '保存しました');
});
