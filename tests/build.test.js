const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { brotliDecompressSync, gunzipSync } = require('node:zlib');

test('a production build preserves editable sources, minifies CSS and emits matching compressed public files', async (t) => {
  const { build } = require('../scripts/build');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-build-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'css'));
  const css = '/* Editable source */\n.example { color: red; margin: 0px; }\n';
  await fs.writeFile(path.join(root, 'css/base.css'), css);
  await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><link rel="stylesheet" href="css/base.css?v=1">');
  await fs.writeFile(path.join(root, 'package.json'), '{"private":true}');
  await fs.writeFile(path.join(root, '.env'), 'PRIVATE=true');
  await build(root);
  const output = await fs.readFile(path.join(root, 'dist/css/base.css'));
  assert.ok(output.length < Buffer.byteLength(css));
  assert.equal(await fs.readFile(path.join(root, 'css/base.css'), 'utf8'), css);
  assert.deepEqual(brotliDecompressSync(await fs.readFile(path.join(root, 'dist/css/base.css.br'))), output);
  assert.deepEqual(gunzipSync(await fs.readFile(path.join(root, 'dist/css/base.css.gz'))), output);
  await assert.rejects(fs.access(path.join(root, 'dist/package.json')));
  await assert.rejects(fs.access(path.join(root, 'dist/.env')));
  const first = await fs.readFile(path.join(root, 'dist/index.html'));
  await build(root);
  assert.deepEqual(await fs.readFile(path.join(root, 'dist/index.html')), first);
});
