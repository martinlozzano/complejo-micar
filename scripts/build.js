const fs = require('node:fs/promises');
const path = require('node:path');
const { brotliCompressSync, gzipSync, constants } = require('node:zlib');
const esbuild = require('esbuild');
const { PAGE_NAMES, renderPage, legacyRedirect } = require('./routes');

const SITE_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIRECTORIES = ['assets', 'css', 'js', 'data'];
const PUBLIC_FILE = /^(?:[a-z-]+\.html|(?:robots|llms|llms-full)\.txt|sitemap\.xml)$/;

async function build(root = SITE_DIR) {
  const output = path.join(path.resolve(root), 'dist');
  // Only this generated child directory is replaced; editable sources are never removed.
  if (path.dirname(output) !== path.resolve(root)) throw new Error('Build output must be a child of the site root.');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  let cssSaved = 0;
  async function write(relative, body) {
    const target = path.join(output, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    if (/\.(?:html|css|js|json|txt|xml|svg)$/.test(relative)) {
      await fs.writeFile(target + '.br', brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
      await fs.writeFile(target + '.gz', gzipSync(body, { level: 9 }));
    }
  }
  async function copy(relative) {
    const source = path.join(root, relative);
    const target = path.join(output, relative);
    const metadata = await fs.stat(source);
    if (metadata.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      for (const name of await fs.readdir(source)) await copy(path.join(relative, name));
      return;
    }
    let body = await fs.readFile(source);
    const page = path.basename(relative, '.html');
    if (PAGE_NAMES.includes(page) && relative === `${page}.html`) {
      await write(path.join(page, 'index.html'), renderPage(body.toString('utf8'), true));
      await write(relative, legacyRedirect(page));
      return;
    }
    if (relative === 'index.html') body = Buffer.from(renderPage(body.toString('utf8')));
    if (relative.endsWith('.css')) {
      const result = await esbuild.transform(body.toString('utf8'), { loader: 'css', minify: true, target: ['chrome109', 'safari16', 'firefox115'], legalComments: 'inline' });
      const minified = Buffer.from(result.code);
      cssSaved += body.length - minified.length;
      body = minified;
    }
    await write(relative, body);
  }
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && PUBLIC_FILE.test(entry.name) || entry.isDirectory() && PUBLIC_DIRECTORIES.includes(entry.name)) await copy(entry.name);
  }
  console.log(`Production files written to dist; CSS reduced by ${cssSaved.toLocaleString('en-US')} bytes.`);
}

if (require.main === module) build().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { build };
