// Structural check of the built extension (run after `npm run build`).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const exists = (f) => fs.existsSync(path.join(dist, f));
assert.ok(exists('manifest.json'), 'dist/manifest.json exists (run npm run build first)');

const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.host_permissions, undefined, 'no static host_permissions');
assert.deepEqual(manifest.optional_host_permissions, ['https://*/*', 'http://*/*']);

const referenced = [
  manifest.background.service_worker,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
];
for (const html of ['note.html', manifest.options_page]) {
  referenced.push(html);
  const text = fs.readFileSync(path.join(dist, html), 'utf8');
  for (const [, ref] of text.matchAll(/(?:src|href)="([^"]+)"/g)) referenced.push(ref);
}
for (const f of referenced) assert.ok(exists(f), `dist/${f} exists`);

for (const f of fs.readdirSync(dist).filter((f) => f.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(dist, f), 'utf8');
  assert.ok(!/^\s*import\s|\bfrom\s*["']@websender/m.test(code), `dist/${f} is fully bundled`);
  assert.ok(!/console\./.test(code), `dist/${f} has no console logging`);
  assert.ok(!/X-Automation-Key/i.test(code), `dist/${f} has no X-Automation-Key`);
}

console.log(`ok: dist has ${referenced.length} referenced files, all present`);
