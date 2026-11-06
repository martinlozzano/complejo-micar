#!/usr/bin/env node

/**
 * Complejo MICAR - Batch WebP Converter & Optimizer
 * Converts all PNG, JPG, and JPEG photos in subdirectories to optimized .webp,
 * auto-orients, limits max dimension to 1920px (preserving aspect ratio),
 * preserves the original master files,
 * and automatically triggers update-gallery.js.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { updateGallery } = require('./update-gallery');

const SITE_DIR = path.resolve(__dirname, '..');
const PHOTOS_DIR = path.join(SITE_DIR, 'assets/img/photos');

const TARGET_FOLDERS = [
  'casa',
  'cabana1',
  'cabana2',
  'cabana3',
  'pileta-parque',
  'juegos-ninos',
  'quincho',
  'paisajes-rios-demas'
];

async function convertImage(source, destination) {
  const image = await sharp(source)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await fs.promises.writeFile(destination, image);
}

async function convertAll() {
  console.log('[1/3] Scanning photo folders for PNG, JPG and JPEG files...');
  
  const filesToConvert = [];
  let originalTotalBytes = 0;

  for (const folder of TARGET_FOLDERS) {
    const folderPath = path.join(PHOTOS_DIR, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      if (/\.(png|jpg|jpeg)$/i.test(file)) {
        const fullPath = path.join(folderPath, file);
        const size = fs.statSync(fullPath).size;
        originalTotalBytes += size;
        filesToConvert.push({
          folder,
          filename: file,
          fullPath,
          size
        });
      }
    }
  }

  if (filesToConvert.length === 0) {
    console.log('No PNG/JPG/JPEG files found. All images are already WebP!');
    updateGallery();
    return;
  }

  console.log(`Found ${filesToConvert.length} images (${(originalTotalBytes / (1024 * 1024)).toFixed(2)} MB) to convert.`);
  console.log('[2/3] Converting to optimized WebP (max 1920px, quality 82)...');

  let convertedCount = 0;
  let newTotalBytes = 0;

  for (let i = 0; i < filesToConvert.length; i++) {
    const item = filesToConvert[i];
    const parsed = path.parse(item.filename);
    const targetFilename = `${parsed.name}.webp`;
    const targetPath = path.join(PHOTOS_DIR, item.folder, targetFilename);

    try {
      await convertImage(item.fullPath, targetPath);

      const newSize = fs.statSync(targetPath).size;
      newTotalBytes += newSize;

      if (fs.existsSync(targetPath) && newSize > 0) {
        convertedCount++;
      }

      if ((i + 1) % 25 === 0 || i + 1 === filesToConvert.length) {
        console.log(`  Processed ${i + 1}/${filesToConvert.length} photos...`);
      }
    } catch (err) {
      console.error(`  [ERROR] Failed to convert ${item.folder}/${item.filename}:`, err.message);
    }
  }

  const savedMB = ((originalTotalBytes - newTotalBytes) / (1024 * 1024)).toFixed(2);
  const percentSaved = ((1 - newTotalBytes / originalTotalBytes) * 100).toFixed(1);

  console.log(`\n[OK] Conversion complete!`);
  console.log(`- Photos converted: ${convertedCount}`);
  console.log(`- Previous size: ${(originalTotalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`- New WebP size: ${(newTotalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`- Space saved: ${savedMB} MB (${percentSaved}% reduction!)\n`);

  console.log('[3/3] Updating galeria.html references...');
  updateGallery();
}

if (require.main === module) {
  convertAll().catch(err => {
    console.error('Conversion failed:', err);
    process.exit(1);
  });
}

module.exports = { convertAll, convertImage };
