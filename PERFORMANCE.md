# Build and verify the static site

The editable HTML, CSS and generated responsive photos work with a normal static server. Use the production build for minified CSS and precompressed text assets; the original photos remain available for gallery lightboxes and future exports.

## Quick path

Use Node.js 22.19+ or 24 LTS and an installed Google Chrome for browser checks. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

```sh
npm ci
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. The preview binds only to localhost and serves public files. Run `npm run preview -- --source` to inspect editable sources instead of `dist`.

## Images and CSS

- `npm run images` generates real WebP width variants in `assets/img/responsive/`, plus AVIF hero images with a WebP fallback, and updates image candidates and dimensions. `data-image-source` retains each master path so regeneration is repeatable. Existing photo masters are preserved and never upscaled.
- `npm run fonts` copies the Inter and Playfair Display Latin variable WOFF2 subsets and their OFL licenses from pinned Fontsource packages. The pages preload the two normal faces and load italic Playfair only where needed, keeping the existing weight ranges and `font-display: swap`.
- `npm run gallery` regenerates the gallery and reapplies responsive markup. Full-size lightbox references keep their original photos.
- `npm run convert-webp` converts incoming PNG/JPEG files without deleting them. Gallery generation prefers the matching WebP to avoid duplicate entries.
- `npm run build` vendors fonts, regenerates responsive photos, replaces the generated `dist/` directory, minifies CSS there and emits `.br`/`.gz` companions. Keep editing source CSS, rather than generated output. No CSS selectors are purged.

## Repeatable browser checks

```sh
npm run audit:lighthouse -- --label=current --runs=3
npm run test:browser -- --label=current
```

Lighthouse launches a fresh headless Chrome profile for each run, disables extensions, fixes viewport and simulated throttling, and saves JSON under `artifacts/lighthouse/`. The browser smoke check covers all six pages at 390 and 1350 pixels, tablet navigation, gallery filtering/lightbox, booking date synchronization, local resource loading and screenshots under `artifacts/screenshots/`.

Both commands use `dist` by default; pass `--source` or `--root=path/to/public-snapshot` to target another public directory. Compare medians using the same Chrome/Lighthouse versions and configuration. Avoid running other browser work during audits.

The initial public snapshot for this change is in ignored `artifacts/baseline-source/`, with per-file SHA-256 hashes in `artifacts/baseline-manifest.json`. It can be measured with:

```sh
npm run audit:lighthouse -- --root=artifacts/baseline-source --label=before --runs=3
```

## Deploying

Upload the contents of `dist/` to the existing static host. The build does not configure or publish a hosting service. Enable Brotli/gzip there, or configure the host to serve the generated compressed companions with the correct `Content-Encoding`, original `Content-Type` and `Vary: Accept-Encoding` headers. Verify those headers on the deployed URL; uploading `.br` and `.gz` files alone does not enable compression.

Revalidate HTML and mutable asset URLs. Only use long immutable caching for assets with a content version in their URL. The local preview deliberately uses `Cache-Control: no-cache` to avoid stale development assets.

Canonical URLs, the robots sitemap directive and sitemap locations use the existing public domain `https://cabanasmicar.com.ar/`. Keep them consistent if the public domain changes. Lighthouse lab scores do not measure real-user INP; confirm LCP, INP and CLS on production with field data when available.
