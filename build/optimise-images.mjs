/* ==========================================================================
   Image optimiser — `npm run images`

   Supplier images arrive at print-ish sizes (one was 182 KB for something
   that renders 150 px wide). This resizes and re-encodes them in place.

   Safe to re-run: it skips any file it cannot improve, and never enlarges a
   smaller source. Originals are recoverable from git.
   ========================================================================== */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

import { ROOT } from './lib/layout.mjs';

/* Target widths are ~2x the largest rendered size, so the images stay crisp
   on high-density screens without carrying pixels nobody sees.

   `variants` are additional narrower copies written alongside the original as
   `name-400.webp` etc. The templates offer these via srcset so a phone
   showing a 150 px thumbnail does not download a 1200 px file. */
const TARGETS = [
  { dir: 'img/products', maxWidth: 1200, quality: 78, variants: [400, 800] },
  { dir: 'img/blog', maxWidth: 1600, quality: 74, variants: [640] },
];

/** Variant files are outputs, not sources: never re-process them. */
const isVariant = (file) => /-\d{3,4}\.webp$/.test(file);

const kb = (bytes) => Math.round(bytes / 1024);

let beforeTotal = 0;
let afterTotal = 0;
let variantCount = 0;
let variantBytes = 0;
const rows = [];

/** src path -> list of available widths (the full-size width included). */
const manifest = new Map();
const widthsFor = (src) => {
  if (!manifest.has(src)) manifest.set(src, []);
  return manifest.get(src);
};

for (const { dir, maxWidth, quality, variants } of TARGETS) {
  const abs = join(ROOT, dir);

  let files;
  try {
    files = readdirSync(abs).filter(
      (f) => extname(f).toLowerCase() === '.webp' && !isVariant(f)
    );
  } catch {
    console.warn(`Skipping ${dir}: not found`);
    continue;
  }

  for (const file of files) {
    const path = join(abs, file);
    const before = statSync(path).size;

    // Read into memory first: on Windows, sharp keeps the source file open
    // and writing back to the same path fails with EBUSY/UNKNOWN.
    const source = readFileSync(path);
    const image = sharp(source);
    const meta = await image.metadata();

    const output = await image
      .resize({
        width: Math.min(meta.width ?? maxWidth, maxWidth),
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 6 })
      .toBuffer();

    beforeTotal += before;

    // Record the full-size width first; variants are appended below.
    widthsFor(`/${dir}/${file}`).push(
      Math.min(meta.width ?? maxWidth, maxWidth)
    );

    // Never write a bigger file than we started with.
    if (output.length >= before) {
      afterTotal += before;
      rows.push([`${dir}/${file}`, kb(before), kb(before), meta.width, 'kept']);

      for (const width of variants) {
        if ((meta.width ?? 0) <= width) continue;
        const small = await sharp(source)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality, effort: 6 })
          .toBuffer();
        writeFileSync(join(abs, `${basename(file, '.webp')}-${width}.webp`), small);
        variantCount++;
        variantBytes += small.length;
        widthsFor(`/${dir}/${file}`).push(width);
      }
      continue;
    }

    writeFileSync(path, output);
    afterTotal += output.length;

    const newMeta = await sharp(output).metadata();
    rows.push([
      `${dir}/${file}`,
      kb(before),
      kb(output.length),
      `${meta.width}→${newMeta.width}`,
      `-${Math.round((1 - output.length / before) * 100)}%`,
    ]);

    // Narrower copies for srcset.
    for (const width of variants) {
      if ((newMeta.width ?? 0) <= width) continue;

      const small = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer();

      const name = `${basename(file, '.webp')}-${width}.webp`;
      writeFileSync(join(abs, name), small);
      variantCount++;
      variantBytes += small.length;
      widthsFor(`/${dir}/${file}`).push(width);
    }
  }
}

/* The build needs to know which widths exist to write a correct srcset, and
   should not have to depend on sharp to find out. */
writeFileSync(
  join(ROOT, 'data', 'images.json'),
  JSON.stringify(
    Object.fromEntries(
      [...manifest.entries()].map(([src, widths]) => [
        src,
        [...widths].sort((a, b) => a - b),
      ])
    ),
    null,
    2
  ) + '\n'
);

const pad = (v, n) => String(v).padEnd(n);
console.log(
  `${pad('FILE', 34)}${pad('BEFORE', 9)}${pad('AFTER', 9)}${pad('WIDTH', 14)}SAVED`
);
for (const [file, b, a, w, saved] of rows) {
  console.log(`${pad(basename(file), 34)}${pad(b + ' KB', 9)}${pad(a + ' KB', 9)}${pad(w, 14)}${saved}`);
}

console.log(
  `\nFull-size: ${kb(beforeTotal)} KB → ${kb(afterTotal)} KB ` +
    `(saved ${kb(beforeTotal - afterTotal)} KB, ` +
    `${Math.round((1 - afterTotal / beforeTotal) * 100)}%)`
);
console.log(
  `Variants:  ${variantCount} files, ${kb(variantBytes)} KB total ` +
    `(served instead of the full size on small screens)`
);
