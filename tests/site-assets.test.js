const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://complejomicar.com';
const PAGE_PATHS = ['/', '/cabanas/', '/reserva/', '/servicios/', '/ubicacion/', '/galeria/'];

function sourceFile(pathname) {
  return pathname === '/' ? 'index.html' : pathname.endsWith('/') ? `${pathname.slice(1, -1)}.html` : pathname.slice(1);
}

test('the sitemap, robots directive and page canonicals agree on absolute public URLs', async () => {
  const sitemap = await fs.readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const robots = await fs.readFile(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN.replaceAll('.', '\\.')}\/sitemap\\.xml`));
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locations).size, locations.length);
  assert.deepEqual(locations.map((location) => new URL(location).pathname).sort(), [...PAGE_PATHS, '/llms.txt'].sort());
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, ORIGIN);
    const filename = sourceFile(url.pathname);
    const content = await fs.readFile(path.join(ROOT, filename), 'utf8');
    if (filename.endsWith('.html')) assert.equal(content.match(/<link rel="canonical" href="([^"]+)"/)?.[1], location);
  }
});

test('social and structured metadata identify the canonical site and real public images', async () => {
  async function checkImage(value) {
    const url = new URL(value);
    assert.equal(url.origin, ORIGIN);
    assert.ok(url.pathname.startsWith('/assets/img/'));
    await fs.access(path.join(ROOT, url.pathname.slice(1)));
  }
  async function checkStructuredData(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'image') {
        for (const image of [child].flat()) await checkImage(image);
      } else if (key === 'url') {
        assert.equal(new URL(child).origin, ORIGIN);
      } else {
        await checkStructuredData(child);
      }
    }
  }
  for (const pathname of PAGE_PATHS) {
    const filename = sourceFile(pathname);
    const html = await fs.readFile(path.join(ROOT, filename), 'utf8');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical, ORIGIN + pathname);
    assert.equal(html.match(/<meta property="og:url" content="([^"]+)"/)?.[1], canonical);
    for (const name of ['og:image', 'twitter:image']) {
      const value = html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]+)"`))?.[1];
      assert.ok(value, `${filename} is missing ${name}`);
      await checkImage(value);
    }
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(json);
      if (pathname === '/') assert.equal(data.url, canonical);
      await checkStructuredData(data);
    }
  }
});

test('home responsive candidates refer to distinct real images with truthful width descriptors', async () => {
  const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]).filter((tag) => tag.includes('assets/img/photos/') || tag.includes('assets/img/responsive/'));
  assert.ok(images.length >= 12);
  for (const image of images) {
    const candidates = image.match(/\bsrcset="([^"]+)"/)?.[1].split(',').map((candidate) => candidate.trim().split(/\s+/));
    assert.ok(candidates?.length >= 2, `Missing variants: ${image}`);
    assert.equal(new Set(candidates.map(([url]) => url)).size, candidates.length);
    for (const [url, descriptor] of candidates) {
      const metadata = await sharp(await fs.readFile(path.join(ROOT, url))).metadata();
      assert.equal(`${metadata.width}w`, descriptor);
    }
    if (image.includes('hero__media')) {
      assert.ok(!image.includes('loading="lazy"'));
      assert.ok(image.includes('fetchpriority="high"'));
    }
  }
  const heroPicture = html.match(/<picture data-responsive-picture>[\s\S]*?<\/picture>/)?.[0];
  assert.ok(heroPicture?.includes('type="image/avif"'));
  assert.ok(heroPicture.includes('.webp'), 'Keep a WebP fallback for browsers without AVIF support.');
  const avifCandidates = heroPicture.match(/<source[^>]+srcset="([^"]+)"/)[1].split(',');
  for (const candidate of avifCandidates) {
    const [url, descriptor] = candidate.trim().split(/\s+/);
    const bytes = await fs.readFile(path.join(ROOT, url));
    assert.equal(bytes.toString('ascii', 4, 12), 'ftypavif');
    assert.equal(`${(await sharp(bytes).metadata()).width}w`, descriptor);
  }
});

test('page fonts load from vendored WOFF2 files with redistribution licenses', async () => {
  const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!html.includes('fonts.googleapis.com'));
  const css = await fs.readFile(path.join(ROOT, 'css/fonts.css'), 'utf8');
  for (const [, url] of css.matchAll(/url\("([^"]+)"\)/g)) {
    const bytes = await fs.readFile(path.resolve(ROOT, 'css', url));
    assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
  }
  for (const family of ['inter', 'playfair-display']) assert.match(await fs.readFile(path.join(ROOT, `assets/fonts/${family}-OFL.txt`), 'utf8'), /SIL OPEN FONT LICENSE/i);
});
