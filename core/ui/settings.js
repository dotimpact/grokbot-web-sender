import { validateSettings } from '../index.js';

// onSave(settings) => Promise<string | undefined>: an error message, or nothing on success.
export function mountSettings(root, { initial, onSave }) {
  root.innerHTML = `
    <form class="settings">
      <label>Webhook URL
        <input name="webhookUrl" type="url" required placeholder="https://example.invalid/webhook" autocomplete="off">
      </label>
      <label>キー
        <input name="key" type="password" required autocomplete="off">
      </label>
      <p><button type="submit">保存</button> <span class="status"></span></p>
    </form>`;
  const form = root.querySelector('form');
  const statusEl = root.querySelector('.status');
  form.webhookUrl.value = initial?.webhookUrl ?? '';
  form.key.value = initial?.key ?? '';

  const show = (ok, text) => {
    statusEl.className = `status ${ok ? 'ok' : 'err'}`;
    statusEl.textContent = text;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = validateSettings({ webhookUrl: form.webhookUrl.value, key: form.key.value });
    if (!v.ok) return show(false, v.message);
    const error = await onSave(v.settings);
    show(!error, error ?? '保存しました');
  });
}
