import { send, fetchTransport } from '@websender/core';

const MENU_ID = 'send-to-grokbot';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Grok Bot に送る',
      contexts: ['page', 'selection', 'link', 'image'],
    });
  });
});

function openNoteWindow(capture) {
  const url = chrome.runtime.getURL(`note.html?c=${encodeURIComponent(JSON.stringify(capture))}`);
  return chrome.windows.create({ url, type: 'popup', width: 460, height: 400 });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  openNoteWindow({
    selectionText: info.selectionText ?? '',
    pageUrl: info.pageUrl ?? tab?.url ?? '',
    title: tab?.title ?? '',
    linkUrl: info.linkUrl ?? '',
    srcUrl: info.mediaType === 'image' ? info.srcUrl ?? '' : '',
  });
});

async function readSelection(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => String(getSelection() ?? ''),
    });
    return result?.result ?? '';
  } catch {
    return '';
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  openNoteWindow({
    selectionText: await readSelection(tab.id),
    pageUrl: tab.url ?? '',
    title: tab.title ?? '',
    linkUrl: '',
    srcUrl: '',
  });
});

async function setBadge(ok) {
  await chrome.action.setBadgeBackgroundColor({ color: ok ? '#1a7f37' : '#cf222e' });
  await chrome.action.setBadgeText({ text: ok ? 'OK' : 'ERR' });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'send') return false;
  (async () => {
    const config = await chrome.storage.local.get(['webhookUrl', 'key']);
    const result = await send(config, msg.capture, msg.note, { client: 'chrome-ext', transport: fetchTransport });
    await setBadge(result.ok);
    sendResponse(result);
  })();
  return true;
});
