import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import serverModule from './serve.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv.includes('--source');
const label = process.argv.find((value) => value.startsWith('--label='))?.slice(8) || 'current';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use an alphanumeric screenshot label.');
const directory = path.join(root, 'artifacts/screenshots', label);
await fs.mkdir(directory, { recursive: true });
const customRoot = process.argv.find((value) => value.startsWith('--root='))?.slice(7);
const server = serverModule.createSiteServer(path.resolve(root, customRoot || (source ? '.' : 'dist')));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-extensions'] });
const results = [];
try {
  const routingContext = await browser.newContext({ viewport: { width: 1350, height: 940 }, reducedMotion: 'reduce' });
  const routingPage = await routingContext.newPage();
  const routingFailures = [];
  routingPage.on('pageerror', (error) => routingFailures.push(error.message));
  routingPage.on('response', (response) => { if (response.url().startsWith(base) && response.status() >= 400) routingFailures.push(`${response.status()} ${response.url()}`); });
  await routingPage.goto(base + '/');
  await routingPage.locator('#site-nav a[href$="galeria/"]').click();
  assert.equal(new URL(routingPage.url()).pathname, '/galeria/');
  await routingPage.reload();
  await routingPage.goto(`${base}/galeria.html?from=legacy#casa`);
  await routingPage.waitForURL(`${base}/galeria/?from=legacy#casa`);
  assert.equal(await routingPage.locator('[data-filter="casa"]').getAttribute('aria-pressed'), 'true');
  await routingPage.locator('.gallery-item:not([hidden]) .gallery-card').first().click();
  await routingPage.locator('.lightbox__img').evaluate((image) => image.decode());
  await routingPage.keyboard.press('Escape');
  await routingPage.locator('[data-filter="todo"]').click();
  assert.equal(new URL(routingPage.url()).search, '?from=legacy');
  await routingPage.locator('#site-nav a[href$="reserva/"]').click();
  assert.equal(new URL(routingPage.url()).pathname, '/reserva/');
  await routingPage.reload();
  assert.ok(await routingPage.locator('#checkin').isVisible());
  assert.deepEqual(routingFailures, [], 'Navigation, legacy redirects and dynamic images must load without errors');
  await routingContext.close();
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const fallbackPage = await noScript.newPage();
  await fallbackPage.goto(`${base}/reserva.html`);
  await fallbackPage.waitForURL(`${base}/reserva/`);
  assert.ok(await fallbackPage.locator('h1').isVisible());
  await noScript.close();
  console.log('PASS home → gallery → booking, reload, legacy query/hash, lightbox and no-JS redirect');
  for (const width of process.argv.includes('--responsive-only') ? [] : [390, 1350]) {
    const context = await browser.newContext({ viewport: { width, height: 940 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      window.micarLcpCandidates = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.micarLcpCandidates.push({ tag: entry.element?.tagName, id: entry.element?.id, className: entry.element?.className, url: entry.url, startTime: entry.startTime, size: entry.size });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => { if (response.url().startsWith(base) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    for (const filename of ['index', 'cabanas', 'servicios', 'galeria', 'ubicacion', 'reserva']) {
      assert.equal((await page.goto(`${base}${filename === 'index' ? '/' : `/${filename}/`}`, { waitUntil: 'load' })).status(), 200);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.hero__media').evaluate((image) => image.decode());
      assert.ok(await page.locator('h1').isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${filename}: horizontal overflow at ${width}px`);
      if (filename === 'index') {
        await page.waitForFunction(() => document.querySelector('#whatsapp-popup').classList.contains('is-visible'));
        const lcp = await page.evaluate(() => window.micarLcpCandidates.at(-1));
        if (width === 390) {
          assert.ok(await page.locator('.bottom-nav').isVisible());
          await page.setViewportSize({ width: 800, height: 940 });
          await page.locator('.nav-toggle').click();
          assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'false');
          await page.setViewportSize({ width, height: 940 });
        } else {
          await page.locator('[data-carousel-next]').click();
          await page.waitForFunction(() => document.querySelector('.carousel__track').scrollLeft > 0);
          await page.evaluate(() => scrollTo(0, 0));
        }
        results.push({ viewport: width, lcp, hero: await page.locator('.hero__media').evaluate((image) => ({ url: image.currentSrc, naturalWidth: image.naturalWidth })) });
      }
      if (filename === 'galeria') {
        if (!await page.locator('[data-filter="casa"]').isVisible()) await page.locator('[data-filter-trigger]').click();
        await page.locator('[data-filter="casa"]').click();
        assert.equal(await page.locator('[data-filter="casa"]').getAttribute('aria-pressed'), 'true');
        await page.locator('.gallery-item:not([hidden]) .gallery-card').first().click();
        assert.ok(await page.locator('[data-lightbox]').evaluate((dialog) => dialog.open));
        await page.keyboard.press('Escape');
      }
      if (filename === 'reserva') {
        await page.locator('#accommodation').selectOption('cabana2');
        assert.match(await page.locator('#guests-hint').textContent(), /3/);
        const checkin = new Date(`${await page.locator('#checkin').getAttribute('min')}T12:00:00Z`);
        checkin.setUTCDate(checkin.getUTCDate() + 30);
        await page.locator('#checkin').fill(checkin.toISOString().slice(0, 10));
        await page.locator('#nights').fill('3');
        checkin.setUTCDate(checkin.getUTCDate() + 3);
        assert.equal(await page.locator('#checkout').inputValue(), checkin.toISOString().slice(0, 10));
        await page.evaluate(() => scrollTo(0, 0));
      }
      // Full-page screenshots also need rendered images below the initial viewport.
      await page.locator('img').evaluateAll((images) => Promise.all(images.filter((image) => image.getClientRects().length && image.getAttribute('src')).map(async (image) => {
        image.loading = 'eager';
        await image.decode();
      })));
      await page.screenshot({ path: path.join(directory, `${filename}-${width}.png`), fullPage: true });
      console.log(`PASS ${filename === 'index' ? '/' : `/${filename}/`} at ${width}px`);
    }
    assert.deepEqual(failures, [], 'Browser errors or broken local resources');
    await context.close();
  }
  for (const width of [800, 1000]) {
    for (const deviceScaleFactor of [1, 2]) {
      const context = await browser.newContext({ viewport: { width, height: 940 }, deviceScaleFactor, reducedMotion: 'reduce' });
      const page = await context.newPage();
      for (const filename of ['index', 'cabanas', 'servicios', 'galeria', 'ubicacion', 'reserva']) {
        await page.goto(`${base}${filename === 'index' ? '/' : `/${filename}/`}`, { waitUntil: 'load' });
        const images = await page.locator('img[data-image-source]').evaluateAll(async (elements) => {
          const visible = elements.filter((image) => image.getClientRects().length);
          await Promise.all(visible.map(async (image) => { image.loading = 'eager'; await image.decode(); }));
          return visible.map((image) => ({ master: image.dataset.imageSource, current: image.currentSrc, width: image.getBoundingClientRect().width }));
        });
        for (const image of images) {
          const actualWidth = Number(image.current.match(/-(\d+)\.(?:webp|avif)$/)?.[1]);
          const sharp = (await import('sharp')).default;
          const metadata = await sharp(path.join(root, image.master)).metadata();
          const masterWidth = metadata.orientation >= 5 ? metadata.height : metadata.width;
          assert.ok(actualWidth + 2 >= Math.min(image.width * deviceScaleFactor, masterWidth), `${filename} at ${width}px DPR ${deviceScaleFactor}: ${image.master} rendered ${image.width}px but selected ${actualWidth}px`);
        }
        if (deviceScaleFactor === 1 && ['ubicacion', 'servicios'].includes(filename)) await page.screenshot({ path: path.join(directory, `${filename}-${width}.png`), fullPage: true });
      }
      console.log(`PASS responsive selection at ${width}px DPR ${deviceScaleFactor}`);
      await context.close();
    }
  }
  await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
