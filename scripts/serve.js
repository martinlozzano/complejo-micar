const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { brotliCompressSync, gzipSync } = require('node:zlib');

const SITE_DIR = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function createSiteServer(root = SITE_DIR) {
  const directory = path.resolve(root);
  return http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const file = path.resolve(directory, relative);
      const publicPath = /^(?:[a-z-]+\.html|(?:robots|llms|llms-full)\.txt|sitemap\.xml|(?:assets|css|js|data)\/[^.][^\\]*)$/.test(relative);
      if (!publicPath || relative.split('/').some((segment) => segment.startsWith('.')) || !file.startsWith(directory + path.sep) || !['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(404).end();
        return;
      }
      if (!(await fs.realpath(file)).startsWith((await fs.realpath(directory)) + path.sep)) {
        response.writeHead(404).end();
        return;
      }
      let body = await fs.readFile(file);
      const extension = path.extname(file);
      const headers = { 'Content-Type': TYPES[extension] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
      if (/\.(?:html|css|js|json|txt|xml|svg)$/.test(file)) {
        headers.Vary = 'Accept-Encoding';
        const accepted = (request.headers['accept-encoding'] || '').split(',').map((value) => {
          const [encoding, quality = 'q=1'] = value.trim().split(';');
          return { encoding, quality: Number(quality.trim().replace('q=', '')) };
        });
        const supports = (encoding) => accepted.some((item) => item.encoding === encoding && item.quality > 0);
        const encoding = supports('br') ? 'br' : supports('gzip') ? 'gzip' : null;
        if (encoding) {
          try { body = await fs.readFile(file + (encoding === 'br' ? '.br' : '.gz')); }
          catch (error) {
            if (error.code !== 'ENOENT') throw error;
            body = encoding === 'br' ? brotliCompressSync(body) : gzipSync(body);
          }
          headers['Content-Encoding'] = encoding;
        }
      }
      headers['Content-Length'] = body.length;
      response.writeHead(200, headers).end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400).end();
    }
  });
}

if (require.main === module) {
  const source = process.argv.includes('--source');
  const root = source ? SITE_DIR : path.join(SITE_DIR, 'dist');
  createSiteServer(root).listen(4173, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:4173 (${source ? 'source' : 'dist'})`));
}

module.exports = { createSiteServer };
