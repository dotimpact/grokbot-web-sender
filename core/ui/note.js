// onSend(note) => Promise<{ ok, message }>. onSuccess runs 800ms after a successful send.
export function mountNote(root, { capture, onSend, onSuccess }) {
  root.innerHTML = `
    <div class="meta"></div>
    <blockquote class="preview"></blockquote>
    <textarea class="note" placeholder="メモ（Cmd/Ctrl+Enter で送信）"></textarea>
    <div class="row"><button type="button" class="send">送信</button><span class="status"></span></div>`;
  const $ = (sel) => root.querySelector(sel);
  const noteEl = $('.note');
  const sendBtn = $('.send');
  const statusEl = $('.status');

  $('.meta').textContent = [capture.title, capture.srcUrl || capture.linkUrl || capture.pageUrl].filter(Boolean).join(' · ');
  $('.preview').textContent = capture.selectionText ?? '';

  async function send() {
    sendBtn.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = '送信中…';
    const result = await onSend(noteEl.value);
    statusEl.className = `status ${result.ok ? 'ok' : 'err'}`;
    statusEl.textContent = result.message;
    if (result.ok) {
      setTimeout(onSuccess, 800);
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
  noteEl.focus();
}
