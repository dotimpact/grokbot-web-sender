import { mountNote } from '@websender/core/ui/note.js';
import '@websender/core/ui/ui.css';

const capture = JSON.parse(new URLSearchParams(location.search).get('c') ?? '{}');

mountNote(document.getElementById('app'), {
  capture,
  onSend: (note) => chrome.runtime.sendMessage({ type: 'send', capture, note }),
  onSuccess: () => window.close(),
});
