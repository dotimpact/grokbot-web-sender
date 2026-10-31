import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, send, validateSettings, splitShared, shareToCapture } from '../index.js';

const URL_ = 'https://example.invalid/hook';
const KEY = 'test-key-not-real';
const NOW = new Date('2026-10-31T08:00:00.000Z');
const KEYS = ['v', 'note', 'selectionText', 'pageUrl', 'title', 'linkUrl', 'srcUrl', 'ts', 'client'];

test('splitShared: Japanese text around URL', () => {
  assert.deepEqual(splitShared('この記事 https://example.invalid/a?b=1 が面白い'), {
    pageUrl: 'https://example.invalid/a?b=1', rest: 'この記事  が面白い',
  });
  assert.deepEqual(splitShared('「記事」https://example.invalid/x」より'), {
    pageUrl: 'https://example.invalid/x', rest: '「記事」」より',
  });
});

test('splitShared: trailing punctuation', () => {
  assert.equal(splitShared('見て https://example.invalid/a。').pageUrl, 'https://example.invalid/a');
  assert.equal(splitShared('見て https://example.invalid/a。').rest, '見て');
  assert.deepEqual(splitShared('See https://example.invalid/a.'), { pageUrl: 'https://example.invalid/a', rest: 'See' });
  assert.deepEqual(splitShared('(see https://example.invalid/a)'), { pageUrl: 'https://example.invalid/a', rest: '(see )' });
  assert.equal(splitShared('https://example.invalid/a?!, next').pageUrl, 'https://example.invalid/a');
});

test('splitShared: balanced parens stay in Wikipedia-style URLs', () => {
  const u = 'https://example.invalid/wiki/Foo_(bar)';
  assert.deepEqual(splitShared(`Title\n${u}`), { pageUrl: u, rest: 'Title' });
  assert.deepEqual(splitShared(`(${u})`), { pageUrl: u, rest: '()' });
});

test('splitShared: no URL / URL only / empty', () => {
  assert.deepEqual(splitShared('  ただのメモ  '), { pageUrl: '', rest: 'ただのメモ' });
  assert.deepEqual(splitShared('https://example.invalid/only'), { pageUrl: 'https://example.invalid/only', rest: '' });
  assert.deepEqual(splitShared(undefined), { pageUrl: '', rest: '' });
});

test('splitShared: collapses whitespace left by the URL', () => {
  assert.equal(splitShared('a \nhttps://example.invalid/x\n\n\n\nb').rest, 'a\n\nb');
});

test('shareToCapture: subject is the title; rest equal to title is dropped', () => {
  assert.deepEqual(shareToCapture({ text: 'Page Title https://example.invalid/p', subject: 'Page Title' }), {
    selectionText: '', pageUrl: 'https://example.invalid/p', title: 'Page Title', linkUrl: '', srcUrl: '',
  });
  assert.equal(shareToCapture({ text: '引用文 https://example.invalid/p', subject: 'T' }).selectionText, '引用文');
  assert.equal(shareToCapture({ text: 'x', subject: undefined }).title, '');
});

test('buildPayload: fixed key order, empty strings, client passed in', () => {
  const p = buildPayload({ pageUrl: 'https://example.invalid/p' }, undefined, 'android-app', NOW);
  assert.deepEqual(Object.keys(p), KEYS);
  assert.deepEqual(p, {
    v: 1, note: '', selectionText: '', pageUrl: 'https://example.invalid/p', title: '', linkUrl: '', srcUrl: '',
    ts: '2026-10-31T08:00:00.000Z', client: 'android-app',
  });
  assert.equal(JSON.stringify(buildPayload({}, '', 'chrome-ext', NOW)),
    '{"v":1,"note":"","selectionText":"","pageUrl":"","title":"","linkUrl":"","srcUrl":"","ts":"2026-10-31T08:00:00.000Z","client":"chrome-ext"}');
});

function recorder(status = 200) {
  const calls = [];
  const transport = async (url, req) => { calls.push({ url, ...req }); return { status }; };
  return { calls, transport };
}

test('send: headers and body', async () => {
  const { calls, transport } = recorder(200);
  const tricky = 'say "hi"\nline2\\back 😀 日本語\t ';
  const r = await send({ webhookUrl: URL_, key: KEY }, { selectionText: tricky, title: 'T' }, tricky, { client: 'chrome-ext', transport, now: NOW });
  assert.deepEqual(r, { ok: true, status: 200, message: '送信しました (200)' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL_);
  assert.deepEqual(calls[0].headers, { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` });
  const body = JSON.parse(calls[0].body);
  assert.deepEqual(Object.keys(body), KEYS);
  assert.equal(body.note, tricky);
  assert.equal(body.selectionText, tricky);
  assert.equal(body.client, 'chrome-ext');
});

test('send: missing config makes no request', async () => {
  const { calls, transport } = recorder();
  for (const config of [{}, { webhookUrl: URL_ }, { key: KEY }, undefined]) {
    const r = await send(config, {}, '', { client: 'chrome-ext', transport });
    assert.deepEqual(r, { ok: false, message: 'Webhook URL とキーを設定してください' });
  }
  assert.equal(calls.length, 0);
});

test('send: non-2xx and network errors map to messages without URL or key', async () => {
  const config = { webhookUrl: URL_, key: KEY };
  const opts = (transport) => ({ client: 'android-app', transport });
  const results = [
    await send(config, {}, '', opts(recorder(415).transport)),
    await send(config, {}, '', opts(recorder(500).transport)),
    await send(config, {}, '', opts(async () => { throw new Error(`connect ${URL_} ${KEY}`); })),
  ];
  assert.deepEqual(results[0], { ok: false, status: 415, message: '送信失敗: HTTP 415' });
  assert.equal(results[1].message, '送信失敗: HTTP 500');
  assert.deepEqual(results[2], { ok: false, message: '送信失敗: ネットワークエラー（権限・URL を確認してください）' });
  for (const r of results) {
    assert.ok(!r.message.includes(URL_) && !r.message.includes('example.invalid') && !r.message.includes(KEY));
  }
});

test('validateSettings', () => {
  assert.deepEqual(validateSettings({ webhookUrl: `  ${URL_} `, key: ` ${KEY} ` }), { ok: true, settings: { webhookUrl: URL_, key: KEY } });
  assert.equal(validateSettings({ webhookUrl: 'http://127.0.0.1:8080/h', key: 'k' }).ok, true);
  assert.equal(validateSettings({ webhookUrl: 'not a url', key: KEY }).message, 'URL の形式が正しくありません');
  assert.equal(validateSettings({ webhookUrl: 'ftp://example.invalid/', key: KEY }).message, 'http(s) の URL を指定してください');
  assert.equal(validateSettings({ webhookUrl: 'javascript:alert(1)', key: KEY }).ok, false);
  assert.equal(validateSettings({ webhookUrl: URL_, key: '   ' }).message, 'キーを入力してください');
  assert.equal(validateSettings({}).ok, false);
  const bad = validateSettings({ webhookUrl: `ftp://example.invalid/${KEY}`, key: KEY });
  assert.ok(!bad.message.includes(KEY));
});
