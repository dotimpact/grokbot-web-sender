import { mountSettings } from '@websender/core/ui/settings.js';
import '@websender/core/ui/ui.css';

mountSettings(document.getElementById('app'), {
  initial: await chrome.storage.local.get(['webhookUrl', 'key']),
  async onSave(settings) {
    const { protocol, hostname } = new URL(settings.webhookUrl);
    const granted = await chrome.permissions.request({ origins: [`${protocol}//${hostname}/*`] });
    if (!granted) return 'アクセス許可が拒否されたため保存しませんでした';
    await chrome.storage.local.set(settings);
  },
});
