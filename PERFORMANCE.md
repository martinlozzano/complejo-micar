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

GitHub Pages publishes the optimized `dist/` artifact through `.github/workflows/pages.yml`. To enable it:

1. In the GitHub repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
2. Commit the workflow and merge it into `main`. A push to `main` runs dependency installation, tests and the production build, then deploys only `dist/`.
3. Open **Actions → Deploy GitHub Pages** and check that both jobs succeed. To retry or deploy manually, choose **Run workflow** with the `main` branch selected.

The public address remains `https://martinlozzano.github.io/complejo-micar/`. Keep `dist/` ignored: Actions generates and uploads it, so it does not need to be committed. A failed test or build prevents deployment. Manual runs from another branch can build an artifact but cannot deploy it. No personal access token or repository secret is required; deployment uses GitHub's workflow token and OIDC permissions.

The workflow does not change repository settings by itself. See [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the publishing-source and environment requirements.

For another static host, upload the contents of `dist/` and configure that host separately. Generated `.br`/`.gz` companions do not enable compression by themselves; serving them requires the correct `Content-Encoding`, original `Content-Type` and `Vary: Accept-Encoding` headers. On GitHub Pages, compression and cache response headers are managed by the platform; verify the deployed responses rather than assuming the companion files are used.

Revalidate HTML and mutable asset URLs. Only use long immutable caching for assets with a content version in their URL. The local preview deliberately uses `Cache-Control: no-cache` to avoid stale development assets.

Canonical URLs, the robots sitemap directive and sitemap locations still reference `https://cabanasmicar.com.ar/`. Align those separately with the final public address; the deployment workflow does not rewrite them. Lighthouse lab scores do not measure real-user INP; confirm LCP, INP and CLS on production with field data when available.
