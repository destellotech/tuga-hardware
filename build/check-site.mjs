/* ============================================
   TUGA HARDWARE — Site checks
   Run after `npm run build`. Fails (exit 1) on:
     drift  generated output differs from what is committed
            (someone edited HTML by hand, or forgot to rebuild)
     links  an internal href/src/srcset points at a file that does not exist
     a11y   axe-core finds a WCAG 2.1 AA or best-practice violation on a
            representative set of pages, at phone and desktop widths

   Usage: node build/check-site.mjs [drift] [links] [a11y]   (default: all)
   CI runs this on every pull request (.github/workflows/site-checks.yml).
   ============================================ */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const steps = process.argv.slice(2).length ? process.argv.slice(2) : ['drift', 'links', 'a11y'];
let failed = false;
const fail = (msg) => { failed = true; console.error(`FAIL ${msg}`); };
const ok = (msg) => console.log(`ok   ${msg}`);

// Folders that are not part of the published site.
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'src', 'build', '.claude', '.github', 'schema', 'founder']);
// Paths the Worker answers itself (src/worker.js, src/api.js), never files.
const WORKER_PATHS = /^\/(api|admin|webhooks|checkout|order|track|p)(\/|$)/;

function siteFiles(exts) {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (exts.test(e.name)) out.push(p);
    }
  })(ROOT);
  return out;
}

// ---------------------------------------------------------------- drift
if (steps.includes('drift')) {
  // Sitemap <lastmod> and BlogPosting dateModified come from the last git
  // commit touching a page's sources, so a squash merge or a rebuild on a
  // later day moves them without anyone editing anything. Ignore those
  // lines: the check is for hand-edited output and forgotten rebuilds.
  const git = (args) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const untracked = git('ls-files --others --exclude-standard');
  // --name-only ignores -I, so ask for the real diff of each file and keep
  // only those with something left once the date lines are dropped.
  const modified = git('diff --name-only')
    .filter((f) => !/package(-lock)?\.json$/.test(f))
    .filter((f) => git(`diff -I '<lastmod>|"dateModified"' -- "${f}"`).length > 0);
  const changed = [...modified.map((f) => ` M ${f}`), ...untracked.map((f) => `?? ${f}`)];
  if (changed.length) {
    fail(`build output differs from the committed files (run npm run build and commit):\n  ${changed.join('\n  ')}`);
  } else {
    ok('drift: committed files match a fresh build (date-only changes ignored)');
  }
}

// ---------------------------------------------------------------- links
if (steps.includes('links')) {
  const files = siteFiles(/\.(html|xml|txt)$/);
  const broken = new Map();
  let refs = 0;
  const attr = /(?:href|src|srcset|poster)=["']([^"']+)["']|<loc>([^<]+)<\/loc>/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = attr.exec(text))) {
      for (let u of (m[1] || m[2]).split(',')) {
        u = u.trim().split(/\s+/)[0];
        if (!u) continue;
        if (/^https?:\/\/(www\.)?tugahardware\.com/.test(u)) u = u.replace(/^https?:\/\/(www\.)?tugahardware\.com/, '') || '/';
        if (/^(https?:|mailto:|tel:|#|data:|javascript:|\/\/)/.test(u)) continue;
        u = u.split('#')[0].split('?')[0];
        if (!u || WORKER_PATHS.test(u)) continue;
        refs++;
        const target = u.startsWith('/') ? path.join(ROOT, u) : path.join(path.dirname(file), u);
        const exists =
          (fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.existsSync(path.join(target, 'index.html')))) ||
          fs.existsSync(`${target.replace(/\/$/, '')}.html`);
        if (!exists) {
          if (!broken.has(u)) broken.set(u, []);
          broken.get(u).push(path.relative(ROOT, file));
        }
      }
    }
  }
  if (broken.size) {
    fail(`${broken.size} broken internal link target(s):`);
    for (const [u, from] of broken) console.error(`  ${u}  <- ${from.length} file(s), e.g. ${from[0]}`);
  } else {
    ok(`links: ${refs} internal references in ${files.length} files all resolve`);
  }
}

// ---------------------------------------------------------------- a11y
if (steps.includes('a11y')) {
  // One page of each template. Add a path here when a new template appears.
  const PAGES = [
    '/', '/products/', '/products/tuga-a10', '/cart', '/contact', '/which-tuga', '/blog/',
    '/blog/best-rugged-tablets-electricians', '/compare/tuga-a6-vs-tuga-a8', '/for/construction',
    '/works-with/jobber', '/accessories', '/warranty', '/bulk', '/bespoke', '/order-confirmation', '/404.html',
  ];
  const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];
  const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', mp4: 'video/mp4', webm: 'video/webm', xml: 'application/xml', txt: 'text/plain', json: 'application/json' };

  // Serve the built site the way the Worker does: extensionless URLs map to .html.
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, p);
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    else if (!path.extname(p) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end(fs.readFileSync(path.join(ROOT, '404.html')));
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).slice(1)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const { chromium } = await import('playwright');
  const axeSource = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
  const launch = async () => {
    try { return await chromium.launch(); } catch (err) {
      // This container ships Chromium outside Playwright's cache.
      if (fs.existsSync('/opt/pw-browsers/chromium')) return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
      throw err;
    }
  };
  const browser = await launch();
  const violations = new Map();
  let scanned = 0;
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const url of PAGES) {
      await page.goto(origin + url, { waitUntil: 'load' });
      // Reveal animations fade content in; axe would sample half-faded text
      // and report contrast failures that no visitor sees.
      await page.evaluate(() => {
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
        const style = document.createElement('style');
        style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
        document.head.appendChild(style);
      });
      await page.waitForTimeout(300);
      await page.addScriptTag({ content: axeSource });
      const found = await page.evaluate(async () => {
        const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } });
        return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
      });
      scanned++;
      for (const v of found) {
        const key = v.id;
        if (!violations.has(key)) violations.set(key, { impact: v.impact, help: v.help, where: [] });
        violations.get(key).where.push(`${url} @${viewport.width}px: ${v.nodes.slice(0, 2).join(', ')}${v.nodes.length > 2 ? ` (+${v.nodes.length - 2})` : ''}`);
      }
    }
    await context.close();
  }
  await browser.close();
  server.close();
  if (violations.size) {
    fail(`a11y: ${violations.size} axe rule(s) violated across ${scanned} page scans:`);
    for (const [id, v] of violations) {
      console.error(`  ${v.impact.toUpperCase()} ${id}: ${v.help}`);
      for (const w of v.where.slice(0, 4)) console.error(`      ${w}`);
      if (v.where.length > 4) console.error(`      ... and ${v.where.length - 4} more`);
    }
  } else {
    ok(`a11y: no axe violations across ${scanned} page scans (${PAGES.length} pages x ${VIEWPORTS.length} widths)`);
  }
}

process.exit(failed ? 1 : 0);
