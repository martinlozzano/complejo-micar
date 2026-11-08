const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { build } = require('../scripts/build');
const { createSiteServer } = require('../scripts/serve');

const PAGES = ['index', 'cabanas', 'servicios', 'galeria', 'ubicacion', 'reserva'];

test('source and production serve reloadable directory pages with working relative resources and legacy links', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'micar-routes-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [filename, content] of Object.entries({
    'css/site.css': '@font-face { font-family: test; src: url("../assets/font.woff2"); }',
    'js/gallery.js': 'window.ready = true;',
    'assets/photo.webp': 'photo',
    'assets/font.woff2': 'font',
    'llms.txt': '[Gallery](galeria/)\n',
    'package.json': '{"private":true}'
  })) {
    await fs.mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await fs.writeFile(path.join(root, filename), content);
  }
  for (const page of PAGES) {
    await fs.writeFile(path.join(root, `${page}.html`), `<!doctype html><html><head>
      <title>${page}</title><link rel="stylesheet" href="css/site.css?v=1">
      </head><body><h1>${page}</h1><a href="index.html">Home</a>
      <a href="reserva.html?cabin=cabana2#booking">Book</a><a href="#photos">Photos</a>
      <img src="assets/photo.webp" srcset="assets/photo.webp 320w, assets/photo.webp 640w">
      <button data-full="assets/photo.webp">Open</button><script src="js/gallery.js"></script>
      </body></html>`);
  }
  await build(root);
  // These files must exist on static hosts without any application server or rewrite rules.
  for (const page of PAGES.slice(1)) {
    await fs.access(path.join(root, 'dist', page, 'index.html'));
  }
  for (const mode of ['source', 'production']) {
    await t.test(mode, async (t) => {
      const server = createSiteServer(mode === 'source' ? root : path.join(root, 'dist'));
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      t.after(() => new Promise((resolve) => server.close(resolve)));
      const base = `http://127.0.0.1:${server.address().port}`;
      for (const page of PAGES) {
        const route = page === 'index' ? '/' : `/${page}/`;
        const address = base + route + '?from=test';
        const response = await fetch(address);
        assert.equal(response.status, 200, address);
        const html = await response.text();
        assert.match(html, new RegExp(`<h1>${page}</h1>`));
        assert.equal(await (await fetch(address)).text(), html, 'Direct reload must serve the same page');
        assert.ok(html.includes('href="#photos"'), 'Local fragments must stay on this page');
        for (const [, value] of html.matchAll(/(?:href|src|data-full)="([^"]+)"/g)) {
          const url = new URL(value, address);
          assert.ok(!url.pathname.endsWith('.html'), `Navigation still uses ${value}`);
          assert.equal((await fetch(url)).status, 200, url.href);
          const prefixed = new URL(value, `https://example.test/project${route}`);
          assert.ok(prefixed.pathname.startsWith('/project/'), `Link escapes project prefix: ${value}`);
        }
        for (const [, candidates] of html.matchAll(/srcset="([^"]+)"/g)) {
          for (const candidate of candidates.split(',')) assert.equal((await fetch(new URL(candidate.trim().split(' ')[0], address))).status, 200);
        }
        const cssUrl = new URL(html.match(/href="([^"]+\.css\?v=1)"/)[1], address);
        const css = await (await fetch(cssUrl)).text();
        assert.equal((await fetch(new URL(css.match(/url\(["']?([^"')]+)["']?\)/)[1], cssUrl))).status, 200);
        if (page !== 'index') {
          const noSlash = await fetch(`${base}/${page}?from=test`, { redirect: 'manual' });
          assert.equal(noSlash.status, 308);
          assert.equal(noSlash.headers.get('location'), `${route}?from=test`);
          const legacy = await (await fetch(`${base}/${page}.html?cabin=cabana2`)).text();
          assert.match(legacy, /http-equiv="refresh"/i);
          assert.ok(legacy.includes(`href="${page}/"`));
          let destination;
          vm.runInNewContext(legacy.match(/<script>([\s\S]+?)<\/script>/)[1], {
            URL,
            location: { href: `https://example.test/project/${page}.html?cabin=cabana2#photos`, search: '?cabin=cabana2', hash: '#photos', replace(value) { destination = String(value); } }
          });
          assert.equal(destination, `https://example.test/project/${page}/?cabin=cabana2#photos`);
        }
      }
      for (const route of ['/missing/', '/scripts/serve.js', '/package.json', '/galeria/private.html', '/assets/%2e%2e%2fpackage.json', '/assets/%2eprivate', '/galeria%5c..%5cpackage.json']) {
        assert.equal((await fetch(base + route)).status, 404, route);
      }
    });
  }
});
