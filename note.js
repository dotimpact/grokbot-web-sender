const capture = JSON.parse(new URLSearchParams(location.search).get('c') ?? '{}');
const noteEl = document.getElementById('note');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');

document.getElementById('meta').textContent =
  [capture.title, capture.srcUrl || capture.linkUrl || capture.pageUrl].filter(Boolean).join(' · ');
document.getElementById('preview').textContent = capture.selectionText ?? '';

async function send() {
  sendBtn.disabled = true;
  statusEl.className = '';
  statusEl.textContent = '送信中…';
  const result = await chrome.runtime.sendMessage({ type: 'send', capture, note: noteEl.value });
  statusEl.className = result.ok ? 'ok' : 'err';
  statusEl.textContent = result.message;
  if (result.ok) {
    setTimeout(() => window.close(), 800);
  } else {
    sendBtn.disabled = false;
    noteEl.focus();
  }
}

sendBtn.addEventListener('click', send);
noteEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !sendBtn.disabled) {
    e.preventDefault();
    send();
  }
});
