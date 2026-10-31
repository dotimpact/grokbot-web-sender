export const CAPTURE_KEYS = ['selectionText', 'pageUrl', 'title', 'linkUrl', 'srcUrl'];

export const MESSAGES = {
  missingConfig: 'Webhook URL とキーを設定してください',
  network: '送信失敗: ネットワークエラー（権限・URL を確認してください）',
  badUrl: 'URL の形式が正しくありません',
  badScheme: 'http(s) の URL を指定してください',
  missingKey: 'キーを入力してください',
};

export function buildPayload(capture, note, client, now = new Date()) {
  const payload = { v: 1, note: note ?? '' };
  for (const key of CAPTURE_KEYS) payload[key] = capture?.[key] ?? '';
  payload.ts = now.toISOString();
  payload.client = client;
  return payload;
}

// transport: (url, { headers, body }) => Promise<{ status }>; throws on network error.
export async function send(config, capture, note, { client, transport, now }) {
  if (!config?.webhookUrl || !config?.key) return { ok: false, message: MESSAGES.missingConfig };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` };
  const body = JSON.stringify(buildPayload(capture, note, client, now));
  let status;
  try {
    ({ status } = await transport(config.webhookUrl, { headers, body }));
  } catch {
    return { ok: false, message: MESSAGES.network };
  }
  const ok = status >= 200 && status < 300;
  return { ok, status, message: ok ? `送信しました (${status})` : `送信失敗: HTTP ${status}` };
}

export async function fetchTransport(url, { headers, body }) {
  const res = await fetch(url, { method: 'POST', headers, body });
  return { status: res.status };
}

export function validateSettings({ webhookUrl, key }) {
  let url;
  try {
    url = new URL((webhookUrl ?? '').trim());
  } catch {
    return { ok: false, message: MESSAGES.badUrl };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, message: MESSAGES.badScheme };
  const trimmedKey = (key ?? '').trim();
  if (!trimmedKey) return { ok: false, message: MESSAGES.missingKey };
  return { ok: true, settings: { webhookUrl: url.href, key: trimmedKey } };
}

export function splitShared(text) {
  const src = (text || '').trim();
  const m = src.match(/https?:\/\/[^\s<>"'「」『』【】（）。、，．]+/);
  if (!m) return { pageUrl: '', rest: src };
  let url = m[0];
  for (;;) {
    const last = url.slice(-1);
    if ('.,;:!?'.includes(last)) { url = url.slice(0, -1); continue; }
    if (last === ')' && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) { url = url.slice(0, -1); continue; }
    break;
  }
  let after = src.slice(m.index + url.length);
  after = after.replace(/^[.,;:!?。、．，]+(?=\s|$)/, '');
  const rest = (src.slice(0, m.index) + after).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { pageUrl: url, rest };
}

// Android ACTION_SEND: EXTRA_TEXT -> text, EXTRA_SUBJECT -> subject.
export function shareToCapture({ text, subject }) {
  const { pageUrl, rest } = splitShared(text);
  const title = (subject ?? '').trim();
  return { selectionText: rest === title ? '' : rest, pageUrl, title, linkUrl: '', srcUrl: '' };
}
