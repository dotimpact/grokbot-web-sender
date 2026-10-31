export const CAPTURE_KEYS = ['selectionText', 'pageUrl', 'title', 'linkUrl', 'srcUrl'];

export function buildPayload(capture, note, now = new Date()) {
  const payload = { v: 1, note: note ?? '' };
  for (const key of CAPTURE_KEYS) payload[key] = capture[key] ?? '';
  payload.ts = now.toISOString();
  payload.client = 'chrome-ext';
  return payload;
}

export function buildRequest({ webhookUrl, key }, payload) {
  return {
    url: webhookUrl,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    },
  };
}

export async function postCapture(config, capture, note, { fetchFn = fetch, now } = {}) {
  if (!config.webhookUrl || !config.key) {
    return { ok: false, message: 'Webhook URL とキーをオプションで設定してください' };
  }
  const { url, init } = buildRequest(config, buildPayload(capture, note, now));
  try {
    const res = await fetchFn(url, init);
    if (res.ok) return { ok: true, status: res.status, message: `送信しました (${res.status})` };
    return { ok: false, status: res.status, message: `送信失敗: HTTP ${res.status}` };
  } catch {
    return { ok: false, message: '送信失敗: ネットワークエラー（権限・URL を確認してください）' };
  }
}
