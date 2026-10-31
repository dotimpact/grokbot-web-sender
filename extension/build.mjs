import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, 'src');
const dist = path.join(here, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
await build({
  entryPoints: ['background.js', 'note.js', 'options.js'].map((f) => path.join(src, f)),
  outdir: dist,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  logLevel: 'warning',
});
for (const f of ['manifest.json', 'note.html', 'options.html', 'icons']) {
  fs.cpSync(path.join(src, f), path.join(dist, f), { recursive: true });
}
