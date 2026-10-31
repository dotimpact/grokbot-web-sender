import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'test-key-not-real';

const received = [];
let nextStatus = 200;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    received.push({ method: req.method, url: req.url, headers: req.headers, body });
    const isJson = (req.headers['content-type'] ?? '').startsWith('application/json');
    res.writeHead(isJson ? nextStatus : 415).end();
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const webhookUrl = `http://127.0.0.1:${server.address().port}/hook`;

const listeners = {};
const on = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
const badges = [];
const windows = [];
const menus = [];
let storage = {};
let selection = 'selected via scripting';

globalThis.chrome = {
  runtime: { onInstalled: on('installed'), onMessage: on('message'), getURL: (p) => `chrome-extension://id/${p}` },
  contextMenus: { onClicked: on('menu'), removeAll: (cb) => cb(), create: (m) => menus.push(m) },
  action: {
    onClicked: on('action'),
    setBadgeText: async ({ text }) => badges.push(text),
    setBadgeBackgroundColor: async () => {},
  },
  windows: { create: async (o) => windows.push(o) },
  scripting: { executeScript: async ({ func }) => [{ result: selection ?? func() }] },
  storage: { local: { get: async (keys) => Object.fromEntries(keys.filter((k) => k in storage).map((k) => [k, storage[k]])) } },
};

await import(path.join(root, 'background.js'));

const sendViaWindow = (capture, note) =>
  new Promise((resolve) => {
    const keepsChannelOpen = listeners.message({ type: 'send', capture, note }, {}, resolve);
    assert.equal(keepsChannelOpen, true, 'onMessage returns true for async response');
  });
const captureFromWindow = (w) => JSON.parse(new URL(w.url).searchParams.get('c'));

listeners.installed();
assert.deepEqual(menus[0].contexts, ['page', 'selection', 'link', 'image'], 'menu covers four contexts');
assert.equal(menus[0].title, 'Grok Bot に送る');

listeners.menu(
  { menuItemId: 'send-to-grokbot', mediaType: 'image', srcUrl: 'https://example.invalid/a.png', pageUrl: 'https://example.invalid/p' },
  { title: 'Page Title', url: 'https://example.invalid/p' },
);
const imageCapture = captureFromWindow(windows.at(-1));
assert.equal(windows.at(-1).type, 'popup');
assert.deepEqual(imageCapture, {
  selectionText: '', pageUrl: 'https://example.invalid/p', title: 'Page Title', linkUrl: '', srcUrl: 'https://example.invalid/a.png',
}, 'image menu click carries srcUrl only');

listeners.menu(
  { menuItemId: 'send-to-grokbot', selectionText: 'hello 世界', linkUrl: 'https://example.invalid/l', pageUrl: 'https://example.invalid/p' },
  { title: 'T', url: 'https://example.invalid/p' },
);
assert.equal(captureFromWindow(windows.at(-1)).selectionText, 'hello 世界', 'selection survives URL round trip');
assert.equal(captureFromWindow(windows.at(-1)).linkUrl, 'https://example.invalid/l');

await listeners.action({ id: 7, url: 'https://example.invalid/q', title: 'Q' });
assert.equal(captureFromWindow(windows.at(-1)).selectionText, 'selected via scripting', 'action button uses scripting selection');

selection = undefined;
chrome.scripting.executeScript = async () => { throw new Error('Cannot access chrome:// URL'); };
await listeners.action({ id: 8, url: 'chrome://settings', title: 'S' });
assert.equal(captureFromWindow(windows.at(-1)).selectionText, '', 'restricted page falls back to empty selection');

let result = await sendViaWindow(imageCapture, 'メモ');
assert.equal(result.ok, false, 'unset config fails without request');
assert.equal(received.length, 0);
assert.equal(badges.at(-1), 'ERR');

storage = { webhookUrl, key: KEY };
result = await sendViaWindow(imageCapture, 'メモ');
assert.equal(result.ok, true, `success response: ${result.message}`);
assert.equal(badges.at(-1), 'OK');
const req = received.at(-1);
assert.equal(req.method, 'POST');
assert.equal(req.url, '/hook');
assert.equal(req.headers['content-type'], 'application/json');
assert.equal(req.headers.authorization, `Bearer ${KEY}`);
assert.equal(req.headers['x-automation-key'], undefined);
const body = JSON.parse(req.body);
assert.deepEqual(Object.keys(body), ['v', 'note', 'selectionText', 'pageUrl', 'title', 'linkUrl', 'srcUrl', 'ts', 'client'], 'all keys always present');
assert.equal(body.v, 1);
assert.equal(body.note, 'メモ');
assert.equal(body.selectionText, '', 'empty fields are empty strings');
assert.equal(body.srcUrl, 'https://example.invalid/a.png');
assert.equal(body.client, 'chrome-ext');
assert.equal(new Date(body.ts).toISOString(), body.ts, 'ts is ISO 8601');

nextStatus = 415;
result = await sendViaWindow(imageCapture, 'keep me');
assert.equal(result.ok, false);
assert.equal(result.status, 415);
assert.match(result.message, /415/);
assert.equal(badges.at(-1), 'ERR');

server.close();
server.closeAllConnections();
storage = { webhookUrl, key: KEY };
result = await sendViaWindow(imageCapture, 'offline');
assert.equal(result.ok, false, 'network failure reported');
assert.ok(!result.message.includes(webhookUrl) && !result.message.includes(KEY), 'message leaks neither URL nor key');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.host_permissions, undefined, 'no static host_permissions');
for (const f of [manifest.background.service_worker, manifest.options_page, 'note.html', 'note.js', 'options.js', 'lib.js']) {
  assert.ok(fs.existsSync(path.join(root, f)), `${f} exists`);
}
for (const f of ['background.js', 'lib.js', 'note.js', 'options.js']) {
  assert.ok(!/console\./.test(fs.readFileSync(path.join(root, f), 'utf8')), `${f} has no console logging`);
}

console.log(`ok: ${received.length} requests recorded, badges=${badges.join(',')}`);
