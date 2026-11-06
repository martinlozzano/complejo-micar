const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { spawnSync } = require('node:child_process');

test('responsive generation preserves the source and never labels an upscaled image', async (t) => {
  const { generateVariants } = require('../scripts/responsive-images');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-images-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'photo.png');
  await sharp({ create: { width: 700, height: 525, channels: 3, background: '#3e4a2e' } }).png().toFile(source);
  const original = await fs.readFile(source);
  const variants = await generateVariants(source, path.join(root, 'output'), [320, 640, 1200]);
  assert.deepEqual(variants.map((image) => image.width), [320, 640, 700]);
  for (const variant of variants) {
    const metadata = await sharp(await fs.readFile(variant.path)).metadata();
    assert.equal(metadata.width, variant.width);
    assert.equal(metadata.height / metadata.width, 0.75);
  }
  assert.deepEqual(await fs.readFile(source), original);
  const initial = await Promise.all(variants.map((variant) => fs.readFile(variant.path)));
  await generateVariants(source, path.join(root, 'output'), [320, 640, 1200]);
  assert.deepEqual(await Promise.all(variants.map((variant) => fs.readFile(variant.path))), initial);
});

test('preview serves public files and negotiates compressed responses without exposing source tooling', async (t) => {
  const { createSiteServer } = require('../scripts/serve');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-preview-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>MICAR</title>'.repeat(100));
  await fs.writeFile(path.join(root, 'package.json'), '{"private":true}');
  const server = createSiteServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(`${base}/`, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('content-encoding'), 'br');
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(await page.text(), await fs.readFile(path.join(root, 'index.html'), 'utf8'));
  assert.equal((await fetch(`${base}/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/scripts/serve.js`)).status, 404);
  assert.equal((await fetch(`${base}/missing.html`)).status, 404);
  const uncompressed = await fetch(`${base}/`, { headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0' } });
  assert.equal(uncompressed.headers.get('content-encoding'), null);
});

test('legacy conversion preserves the master and the gallery prefers its WebP derivative', async (t) => {
  const { convertImage } = require('../scripts/convert-to-webp');
  const { selectGalleryPhotos } = require('../scripts/update-gallery');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-convert-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'master.png');
  await sharp({ create: { width: 80, height: 60, channels: 3, background: '#d9cbb5' } }).png().toFile(source);
  const original = await fs.readFile(source);
  await convertImage(source, path.join(root, 'master.webp'));
  assert.deepEqual(await fs.readFile(source), original);
  assert.equal((await sharp(await fs.readFile(path.join(root, 'master.webp'))).metadata()).format, 'webp');
  assert.deepEqual(selectGalleryPhotos(['master.png', 'master.webp', 'another.jpg', 'notes.txt']), ['master.webp', 'another.jpg']);
});

test('hero variants can use AVIF while preserving the same source and dimensions', async (t) => {
  const { generateVariants } = require('../scripts/responsive-images');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-avif-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'hero.png');
  await sharp({ create: { width: 320, height: 240, channels: 3, background: '#4a2414' } }).png().toFile(source);
  const [variant] = await generateVariants(source, path.join(root, 'output'), [320], 'avif');
  assert.ok(variant.path.endsWith('.avif'));
  const bytes = await fs.readFile(variant.path);
  assert.equal(bytes.toString('ascii', 4, 12), 'ftypavif');
  assert.equal((await sharp(bytes).metadata()).width, 320);
  await fs.access(source);
});

test('gallery imports from mas-fotos retain real responsive variants when regenerated', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-gallery-import-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(root, 'assets/img/photos/mas-fotos'), { recursive: true });
  const script = path.join(root, 'scripts/responsive-images.js');
  await fs.copyFile(path.resolve(__dirname, '../scripts/responsive-images.js'), script);
  const source = path.join(root, 'assets/img/photos/mas-fotos/river.webp');
  await sharp({ create: { width: 710, height: 500, channels: 3, background: '#7195a1' } }).webp().toFile(source);
  const original = await fs.readFile(source);
  const gallery = '<button data-full="assets/img/photos/mas-fotos/river.webp"><img src="assets/img/photos/mas-fotos/river.webp" loading="lazy"></button><img src="assets/img/photos/casa/unrelated.webp">';
  for (const page of ['index', 'cabanas', 'servicios', 'galeria', 'ubicacion', 'reserva']) {
    await fs.writeFile(path.join(root, `${page}.html`), page === 'galeria' ? gallery : '<!doctype html><title>MICAR</title>');
  }
  const run = () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, NODE_PATH: path.resolve(__dirname, '../node_modules') } });
    assert.equal(result.status, 0, result.stderr);
  };
  run();
  const generated = await fs.readFile(path.join(root, 'galeria.html'), 'utf8');
  assert.match(generated, /srcset="[^"]*assets\/img\/responsive\/mas-fotos\/river-320\.webp 320w/);
  assert.ok(generated.includes('data-full="assets/img/photos/mas-fotos/river.webp"'));
  assert.ok(generated.includes('<img src="assets/img/photos/casa/unrelated.webp">'));
  await assert.rejects(fs.access(path.join(root, 'assets/img/responsive/casa')), { code: 'ENOENT' });
  for (const file of await fs.readdir(path.join(root, 'assets/img/responsive/mas-fotos'))) {
    const metadata = await sharp(await fs.readFile(path.join(root, 'assets/img/responsive/mas-fotos', file))).metadata();
    assert.equal(metadata.width, Number(file.match(/-(\d+)\.webp$/)[1]));
    assert.ok(metadata.width <= 710);
  }
  run();
  assert.equal(await fs.readFile(path.join(root, 'galeria.html'), 'utf8'), generated);
  assert.deepEqual(await fs.readFile(source), original);
});
