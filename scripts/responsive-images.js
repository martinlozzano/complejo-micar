const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const SITE_DIR = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'cabanas.html', 'servicios.html', 'galeria.html', 'ubicacion.html', 'reserva.html'];

function imageSizes(page, tag) {
  const available = 'calc(100vw - clamp(32px, 8vw, 128px))';
  const container = `min(${available}, 1240px)`;
  const wide = `min(${available}, 1360px)`;
  if (tag.includes('hero__media')) return '100vw';
  if (tag.includes('area-map__img')) return `(max-width: 1000px) calc(${wide} - 2px), calc((${wide} - clamp(24px, calc(16px + 2.5vw), 48px)) * 0.66 - 2px)`;
  if (tag.includes('service-card-featured__media')) return `(max-width: 900px) min(${available}, 520px), calc((${wide} - 40px) / 3)`;
  if (tag.includes('nature-card__img')) return `(max-width: 900px) calc((${container} - 16px) / 2), calc((${container} - 48px) / 4)`;
  if (tag.includes('booking-info__media')) return `(max-width: 960px) calc(${container} - clamp(24px, calc(16px + 2vw), 40px)), calc((${container} - clamp(24px, calc(16px + 2vw), 40px) - 16px) / 2.45)`;
  if (tag.includes('split__media')) return `(max-width: 800px) ${container}, calc((${container} - clamp(32px, calc(16px + 4vw), 72px)) * 0.55)`;
  if (tag.includes('cabin-card__media')) return `(max-width: 640px) min(${available}, 520px), (max-width: 1100px) calc((min(${available}, 900px) - clamp(16px, calc(8px + 1vw), 20px)) / 2), calc((${container} - 3 * clamp(16px, calc(8px + 1vw), 20px)) / 4)`;
  if (page === 'reserva.html' && tag.includes('photo-card__media')) return `(max-width: 600px) calc((${wide} - 12px) / 2), (max-width: 1100px) calc((${wide} - 16px) / 2), calc((${wide} - 48px) / 4)`;
  // A gallery photo can become the two-column feature after filtering/pagination.
  if (page === 'galeria.html') return `(max-width: 1024px) ${wide}, calc((${wide} - 16px) / 2)`;
  if (page === 'index.html' && tag.includes('photo-card__media')) return `(max-width: 800px) min(${available}, 560px), calc((${wide} - 32px) / 3)`;
  if (page === 'index.html') return '(max-width: 440px) 77vw, (max-width: 700px) 68vw, (max-width: 1000px) 27vw, (min-width: 1488px) 300px, 23vw';
  return '100vw';
}

async function generateVariants(source, outputDirectory, requestedWidths, format = 'webp') {
  const metadata = await sharp(source).metadata();
  const sourceWidth = metadata.orientation >= 5 ? metadata.height : metadata.width;
  const widths = [...new Set(requestedWidths.map((width) => Math.min(width, sourceWidth)))].sort((a, b) => a - b);
  await fs.mkdir(outputDirectory, { recursive: true });
  const variants = [];
  for (const width of widths) {
    const file = path.join(outputDirectory, `${path.parse(source).name}-${width}.${format}`);
    if (path.resolve(file) === path.resolve(source)) throw new Error('A derivative must not overwrite its source.');
    const pipeline = sharp(source).rotate().resize({ width, withoutEnlargement: true });
    const image = await (format === 'avif' ? pipeline.avif({ quality: 50, effort: 5 }) : pipeline.webp({ quality: 76, effort: 5 })).toBuffer({ resolveWithObject: true });
    await fs.writeFile(file, image.data);
    variants.push({ width: image.info.width, height: image.info.height, path: file });
  }
  return variants;
}

async function updateResponsiveImages() {
  const pages = new Map(await Promise.all(PAGES.map(async (page) => [page, await fs.readFile(path.join(SITE_DIR, page), 'utf8')])));
  const sources = new Map();
  const heroSources = new Set();
  for (const [page, html] of pages) {
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      if (page === 'galeria.html' && !tag.includes('hero__media')) continue;
      const source = tag.match(/\bdata-image-source="(assets\/img\/photos\/[^"?]+)"/)?.[1]
        || tag.match(/\bsrc="(assets\/img\/photos\/[^"?]+)"/)?.[1];
      if (!source) continue;
      sources.set(source, [320, 480, 640, 800, 960, 1280, 1600, 1920]);
      if (tag.includes('hero__media')) heroSources.add(source);
    }
  }
  const generated = new Map();
  const avifHeroes = new Map();
  let totalBytes = 0;
  for (const [source, widths] of sources) {
    const outputDirectory = path.join(SITE_DIR, 'assets/img/responsive', path.dirname(source).replace('assets/img/photos/', ''));
    const variants = await generateVariants(path.join(SITE_DIR, source), outputDirectory, widths);
    generated.set(source, variants.map((variant) => ({ ...variant, url: path.relative(SITE_DIR, variant.path).split(path.sep).join('/') })));
    if (heroSources.has(source)) {
      const avifVariants = await generateVariants(path.join(SITE_DIR, source), outputDirectory, widths, 'avif');
      avifHeroes.set(source, avifVariants.map((variant) => `${path.relative(SITE_DIR, variant.path).split(path.sep).join('/')} ${variant.width}w`).join(', '));
    }
    totalBytes += (await fs.stat(path.join(SITE_DIR, source))).size;
  }
  for (const [page, html] of pages) {
    const updated = html.replace(/<picture data-responsive-picture>[\s\S]*?<\/picture>|<img\b[^>]*>/g, (block) => {
      const tag = block.startsWith('<picture') ? block.match(/<img\b[^>]*>/)[0] : block;
      const source = tag.match(/\bdata-image-source="([^"]+)"/)?.[1] || tag.match(/\bsrc="([^"]+)"/)?.[1];
      const variants = generated.get(source);
      if (!variants) return block;
      const fallback = variants.find((variant) => variant.width >= 640) || variants.at(-1);
      const largest = variants.at(-1);
      const srcset = variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ');
      const sizes = imageSizes(page, tag);
      const image = tag.replace(/\s(?:srcset|sizes|width|height|data-image-source)="[^"]*"/g, '').replace(/\bsrc="[^"]*"/, `src="${fallback.url}" data-image-source="${source}" srcset="${srcset}" sizes="${sizes}" width="${largest.width}" height="${largest.height}"`);
      return tag.includes('hero__media') ? `<picture data-responsive-picture><source type="image/avif" srcset="${avifHeroes.get(source)}" sizes="${sizes}">${image}</picture>` : image;
    });
    if (updated !== html) await fs.writeFile(path.join(SITE_DIR, page), updated);
  }
  console.log(`Generated responsive variants for ${sources.size} photos; originals preserved (${Math.round(totalBytes / 1024)} KiB).`);
}

if (require.main === module) updateResponsiveImages().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { generateVariants, updateResponsiveImages };
