/* ==========================================================================
   Minify the stylesheet and script.

   Runs before build.mjs (see `npm run build`). css/style.css and js/app.js
   stay the readable sources you edit; the pages load the .min files, which
   build/lib/layout.mjs content-hashes like any other asset. The sources are
   left out of the deploy by .assetsignore.

   No `target`: nothing is rewritten for older browsers, so the minified
   output behaves exactly like the source.
   ========================================================================== */

import { transform } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const jobs = [
  { src: 'css/style.css', out: 'css/style.min.css', loader: 'css' },
  { src: 'js/app.js', out: 'js/app.min.js', loader: 'js' },
];

for (const { src, out, loader } of jobs) {
  const input = readFileSync(join(ROOT, src), 'utf8');
  const { code, warnings } = await transform(input, { loader, minify: true, legalComments: 'none' });
  for (const w of warnings) console.warn(`${src}: ${w.text}`);
  writeFileSync(join(ROOT, out), code);
  console.log(`${out}: ${(input.length / 1024).toFixed(1)} KB -> ${(code.length / 1024).toFixed(1)} KB`);
}
