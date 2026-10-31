import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import { send, shareToCapture } from '@websender/core';
import { mountNote } from '@websender/core/ui/note.js';
import { mountSettings } from '@websender/core/ui/settings.js';
import '@websender/core/ui/ui.css';

// Native plugin in android/app/src/main/java/jp/dotimpact/websender/WebSenderPlugin.java
const WebSender = registerPlugin('WebSender');

// The webhook sends no CORS headers, so the request must go through the native HTTP stack.
// `data` is passed as the already-serialized string so the body bytes stay exactly as built.
async function capacitorTransport(url, { headers, body }) {
  const res = await CapacitorHttp.post({ url, headers, data: body });
  return { status: res.status };
}

const app = document.getElementById('app');
const nav = document.getElementById('nav');
let settings = { webhookUrl: '', key: '' };
let capture = null;

function showNote() {
  nav.textContent = '設定';
  nav.onclick = (e) => { e.preventDefault(); showSettings(); };
  mountNote(app, {
    capture,
    onSend: (note) => send(settings, capture, note, { client: 'android-app', transport: capacitorTransport }),
    onSuccess: () => WebSender.close(),
  });
}

function showSettings() {
  nav.hidden = !capture;
  nav.textContent = 'メモに戻る';
  nav.onclick = (e) => { e.preventDefault(); nav.hidden = false; showNote(); };
  mountSettings(app, {
    initial: settings,
    async onSave(next) {
      try {
        await WebSender.saveSettings(next);
      } catch {
        return '設定を保存できませんでした';
      }
      settings = next;
    },
  });
}

function route(shared) {
  capture = shared?.text || shared?.subject ? shareToCapture(shared) : null;
  if (capture && settings.webhookUrl && settings.key) showNote();
  else showSettings();
}

settings = await WebSender.getSettings();
WebSender.addListener('shared', route);
route(await WebSender.getShared());
