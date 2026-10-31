import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
await build({
  entryPoints: [path.join(here, 'src/main.js')],
  outdir: dist,
  bundle: true,
  format: 'esm',
  target: 'chrome100',
  logLevel: 'warning',
});
fs.cpSync(path.join(here, 'src/index.html'), path.join(dist, 'index.html'));
