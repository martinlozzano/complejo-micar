import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright-core';
import serverModule from './serve.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const label = argument('label', 'current');
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use an alphanumeric report label.');
const runs = Number(argument('runs', '3'));
if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error('Use 1 to 5 audit runs.');
const directory = path.join(root, 'artifacts/lighthouse', label);
await fs.mkdir(directory, { recursive: true });
const source = process.argv.includes('--source');
const publicRoot = path.resolve(root, argument('root', source ? '.' : 'dist'));
const server = serverModule.createSiteServer(publicRoot);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const results = [];
try {
  for (const formFactor of ['mobile', 'desktop']) {
    const mobile = formFactor === 'mobile';
    for (let run = 1; run <= runs; run++) {
      const probe = net.createServer();
      await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
      const port = probe.address().port;
      await new Promise((resolve) => probe.close(resolve));
      const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--remote-debugging-port=${port}`, '--disable-extensions'] });
      try {
        const result = await lighthouse(url, { port, output: 'json', logLevel: 'error' }, {
          extends: 'lighthouse:default',
          settings: {
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            formFactor,
            emulatedUserAgent: true,
            throttlingMethod: 'simulate',
            throttling: { rttMs: mobile ? 150 : 40, throughputKbps: mobile ? 1638.4 : 10240, cpuSlowdownMultiplier: mobile ? 4 : 1 },
            screenEmulation: { mobile, width: mobile ? 390 : 1350, height: mobile ? 844 : 940, deviceScaleFactor: mobile ? 1.75 : 1, disabled: false },
          },
        });
        await fs.writeFile(path.join(directory, `${formFactor}-${run}.json`), result.report);
        const { lhr } = result;
        const networkUserAgent = lhr.environment.networkUserAgent;
        if (/Mobile|Android/.test(networkUserAgent) !== mobile) throw new Error(`Unexpected ${formFactor} user agent: ${networkUserAgent}`);
        const row = { formFactor, run, lighthouseVersion: lhr.lighthouseVersion, chromeVersion: browser.version(), scores: Object.fromEntries(Object.entries(lhr.categories).map(([name, category]) => [name, Math.round(category.score * 100)])), lcp: lhr.audits['largest-contentful-paint'].numericValue, fcp: lhr.audits['first-contentful-paint'].numericValue, speedIndex: lhr.audits['speed-index'].numericValue, tbt: lhr.audits['total-blocking-time'].numericValue, cls: lhr.audits['cumulative-layout-shift'].numericValue, bytes: lhr.audits['total-byte-weight'].numericValue };
        results.push(row);
        console.log(JSON.stringify(row));
      } finally { await browser.close(); }
    }
  }
  await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify({ source: publicRoot, results }, null, 2));
} finally { await new Promise((resolve) => server.close(resolve)); }
