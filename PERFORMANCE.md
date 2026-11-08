# Build and verify the static site

The production build works with a normal static server. It exports directory indexes for clean page URLs, minified CSS and precompressed text assets; the original photos remain available for gallery lightboxes and future exports.

## Quick path

Use Node.js 22.19+ or 24 LTS and an installed Google Chrome for browser checks. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

```sh
npm ci
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. The preview binds only to localhost and serves public files. Run `npm run preview -- --source` to inspect editable sources instead of `dist`.

## Public page URLs

The homepage is `/`; the other pages are `/cabanas/`, `/servicios/`, `/galeria/`, `/ubicacion/` and `/reserva/`. Each page is a real `index.html` inside its own output directory, so direct loads and reloads work on static hosting.

Keep editing the root HTML files. `scripts/routes.js` renders their navigation and resource paths for both the source preview and build. Relative output URLs also work when hosted under a project prefix. Fragment links stay on the current page; gallery lightbox paths are rebased along with images, styles and scripts. The gallery and responsive-image generators continue to use the existing flat source layout. Use the included preview for sources; a generic static server should serve `dist/`.

The old `.html` addresses remain as generated redirect documents. JavaScript uses `location.replace` to preserve query parameters and fragments, including gallery filters and booking selections. A meta refresh and visible link support visitors without JavaScript; that fallback opens the clean page without carrying query parameters or fragments. These static documents are client redirects, not HTTP 301 responses. Configure permanent redirects separately if the hosting provider supports them.

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

GitHub Pages publishes the optimized `dist/` artifact through `.github/workflows/pages.yml`. To enable it:

1. In the GitHub repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
2. Commit the workflow and merge it into `main`. A push to `main` runs dependency installation, tests and the production build, then deploys only `dist/`.
3. Open **Actions → Deploy GitHub Pages** and check that both jobs succeed. To retry or deploy manually, choose **Run workflow** with the `main` branch selected.

The intended public address is `https://complejomicar.com/`. Configure the custom domain and DNS separately in the hosting provider; updating source metadata does not connect the domain. Keep `dist/` ignored: Actions generates and uploads it, so it does not need to be committed. A failed test or build prevents deployment. Manual runs from another branch can build an artifact but cannot deploy it. No personal access token or repository secret is required; deployment uses GitHub's workflow token and OIDC permissions.

The workflow does not change repository settings by itself. See [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the publishing-source and environment requirements.

For another static host, upload the contents of `dist/` and configure that host separately. Generated `.br`/`.gz` companions do not enable compression by themselves; serving them requires the correct `Content-Encoding`, original `Content-Type` and `Vary: Accept-Encoding` headers. On GitHub Pages, compression and cache response headers are managed by the platform; verify the deployed responses rather than assuming the companion files are used.

Revalidate HTML and mutable asset URLs. Only use long immutable caching for assets with a content version in their URL. The local preview deliberately uses `Cache-Control: no-cache` to avoid stale development assets.

Canonical URLs, social metadata, structured-data URLs, the robots sitemap directive and sitemap locations use `https://complejomicar.com/` with clean directory page paths. The deployment workflow does not rewrite them. Lighthouse lab scores do not measure real-user INP; confirm LCP, INP and CLS on production with field data when available.
