#!/usr/bin/env node

/**
 * Complejo MICAR - Automatic Gallery Generator
 * Scans assets/img/photos/<category>/, normalizes filenames,
 * reads gallery-meta.json (or auto-generates title/alt), and updates galeria.html.
 */

const fs = require('fs');
const path = require('path');

const SITE_DIR = path.resolve(__dirname, '..');
const PHOTOS_DIR = path.join(SITE_DIR, 'assets/img/photos');
const GALERIA_HTML = path.join(SITE_DIR, 'galeria.html');
const META_FILE = path.join(SITE_DIR, 'data/gallery-meta.json');

const CATEGORIES = {
  casa: {
    folder: 'casa',
    category: 'casa',
    label: 'Casa principal',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  },
  cabana1: {
    folder: 'cabana1',
    category: 'cabana1',
    label: 'Cabaña 1',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>'
  },
  cabana2: {
    folder: 'cabana2',
    category: 'cabana2',
    label: 'Cabaña 2',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>'
  },
  cabana3: {
    folder: 'cabana3',
    category: 'cabana3',
    label: 'Cabaña 3',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>'
  },
  'pileta-parque': {
    folder: 'pileta-parque',
    category: 'pileta-parque pileta',
    label: 'Pileta y parque',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"/></svg>'
  },
  'juegos-ninos': {
    folder: 'juegos-ninos',
    category: 'juegos-ninos parque',
    label: 'Juegos para niños',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/></svg>'
  },
  quincho: {
    folder: 'quincho',
    category: 'quincho comunes',
    label: 'Quincho cabañas',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>'
  },
  'paisajes-rios-demas': {
    folder: 'paisajes-rios-demas',
    category: 'paisajes-rios-demas paisajes',
    label: 'Paisajes y ríos',
    icon: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>'
  }
};

const TITLE_DICTIONARY = {
  'bano': 'Baño',
  'bano-planta-baja': 'Baño (Planta baja)',
  'antebano': 'Antebaño',
  'cocina': 'Cocina',
  'cocina-comedor': 'Cocina comedor',
  'comedor': 'Comedor',
  'living': 'Living',
  'cochera': 'Cochera',
  'exterior': 'Exterior',
  'entrada': 'Entrada',
  'entrada-garaje': 'Entrada / Cochera',
  'habitacion-1': 'Dormitorio 1',
  'habitacion-2': 'Dormitorio 2',
  'dormitorio-matrimonial': 'Dormitorio matrimonial',
  'dormitorio-cuadruple': 'Dormitorio cuádruple',
  'dormitorio-doble-triple': 'Dormitorio (doble / triple)',
  'dormitorio-marinera-planta-alta': 'Dormitorio con cama marinera (Planta alta)',
  'dormitorio-triple-planta-alta': 'Dormitorio triple (Planta alta)',
  'dormitorio-planta-baja': 'Dormitorio (Planta baja)',
  'dormitorio-con-cama-marinera-planta-alta': 'Dormitorio con cama marinera (Planta alta)',
  'dormitorio-con-cama-marinera-planta-baja': 'Dormitorio con cama marinera (Planta baja)',
  'habitacion-matrimonial-planta-alta': 'Dormitorio matrimonial (Planta alta)',
  'parrilla': 'Parrilla / Asador',
  'parrilla-terraza': 'Parrilla en terraza',
  'lavadero-terraza': 'Lavadero en terraza',
  'terraza': 'Terraza',
  'quincho-cochera': 'Quincho / Cochera',
  'quincho-cabanas-actual': 'Quincho cabañas',
  'quincho-cabanas-antes': 'Quincho cabañas (Sector tradicional)',
  'gazebo': 'Gazebo en el parque',
  'mesa-gazebo': 'Sector gazebo',
  'parte-del-parque': 'Parque',
  'lateral-cabanas': 'Lateral del complejo',
  'juegos-para-ninos': 'Juegos infantiles',
  'paisaje-rio': 'Paisajes y ríos de Traslasierra',
  'pileta-parque': 'Pileta y parque'
};

function formatTitle(baseName) {
  // Strip trailing numbers (e.g. -15, -6)
  const nameWithoutNum = baseName.replace(/-\d+$/, '');
  if (TITLE_DICTIONARY[nameWithoutNum]) {
    return TITLE_DICTIONARY[nameWithoutNum];
  }

  // Fallback: capitalize words and replace hyphens
  const clean = nameWithoutNum.replace(/-/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function updateGallery() {
  const metadata = fs.existsSync(META_FILE) ? JSON.parse(fs.readFileSync(META_FILE, 'utf8')) : {};
  let items = [];

  for (const [folderKey, catInfo] of Object.entries(CATEGORIES)) {
    const folderPath = path.join(PHOTOS_DIR, catInfo.folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));

    if (files.length === 0) {
      items.push({
        isPlaceholder: true,
        category: catInfo.category,
        html: `        <li class="gallery-item" data-category="${catInfo.category}">\n` +
              `          <div class="gallery-card placeholder" role="img" aria-label="Foto pendiente: ${catInfo.label}">\n` +
              `            <span class="placeholder__tag">Foto pendiente: ${catInfo.label}</span>\n` +
              `            <span class="gallery-card__caption">${catInfo.icon}${catInfo.label}</span>\n` +
              `          </div>\n` +
              `        </li>`
      });
      continue;
    }

    // Sort files naturally by name
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    files.forEach((file, index) => {
      const parsed = path.parse(file);
      const baseName = parsed.name;
      const metaKey = `${catInfo.folder}/${file}`;
      const metaBaseKey = `${catInfo.folder}/${baseName}`;
      const metaEntry = metadata[metaKey] || metadata[metaBaseKey] || {};

      const caption = metaEntry.caption || formatTitle(baseName);
      const alt = metaEntry.alt || `${caption} en ${catInfo.label} - Cabañas MICAR`;
      
      // Keep hero 2x2 on first item of pileta-parque or if explicitly set
      const isHero = metaEntry.bento === 'large' || (catInfo.folder === 'pileta-parque' && index === 0);
      const bentoAttr = isHero ? ' data-bento="large"' : '';

      const categoryList = catInfo.category.split(' ');
      if (metaEntry.extraCategories && Array.isArray(metaEntry.extraCategories)) {
        metaEntry.extraCategories.forEach(extra => {
          if (!categoryList.includes(extra)) categoryList.push(extra);
        });
      }
      const categoryStr = categoryList.join(' ');

      const mainSrc = `assets/img/photos/${catInfo.folder}/${file}`;

      const itemHtml = `        <li class="gallery-item" data-category="${categoryStr}"${bentoAttr}>\n` +
                       `          <button class="gallery-card" type="button" data-caption="${caption}" data-full="${mainSrc}">\n` +
                       `            <img src="${mainSrc}" alt="${alt}" loading="lazy" decoding="async">\n` +
                       `            <span class="gallery-card__caption">${catInfo.icon}${caption}</span>\n` +
                       `          </button>\n` +
                       `        </li>`;

      items.push({
        isPlaceholder: false,
        folder: catInfo.folder,
        file,
        bento: isHero ? 'large' : null,
        html: itemHtml
      });
    });
  }

  // Ensure large hero item is at position 0 if defined
  const heroIndex = items.findIndex(i => i.bento === 'large');
  if (heroIndex > 0) {
    const [hero] = items.splice(heroIndex, 1);
    items.unshift(hero);
  }

  const generatedHtml = items.map(i => i.html).join('\n');

  let galeriaContent = fs.readFileSync(GALERIA_HTML, 'utf8').replace(/\r\n/g, '\n');

  // Update filters in galeria.html to include all current categories
  const newFiltersHtml = `        <div class="gallery-filters" id="gallery-filters" role="group" aria-label="Filtrar fotos por categoría" data-filter-menu>
          <button class="gallery-filter" type="button" data-filter="todo" aria-pressed="true"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>Todo</button>
          <button class="gallery-filter" type="button" data-filter="casa" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Casa principal</button>
          <button class="gallery-filter" type="button" data-filter="cabana1" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>Cabaña 1</button>
          <button class="gallery-filter" type="button" data-filter="cabana2" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>Cabaña 2</button>
          <button class="gallery-filter" type="button" data-filter="cabana3" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>Cabaña 3</button>
          <button class="gallery-filter" type="button" data-filter="pileta-parque" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"/></svg>Pileta y parque</button>
          <button class="gallery-filter" type="button" data-filter="juegos-ninos" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/></svg>Juegos para niños</button>
          <button class="gallery-filter" type="button" data-filter="quincho" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>Quincho cabañas</button>
          <button class="gallery-filter" type="button" data-filter="paisajes-rios-demas" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>Paisajes y ríos</button>
        </div>`;

  const filtersPattern = /<div class="gallery-filters"[\s\S]*?<\/div>/;
  galeriaContent = galeriaContent.replace(filtersPattern, newFiltersHtml);

  const startTag = '<!-- GALLERY_GRID_START -->';
  const endTag = '<!-- GALLERY_GRID_END -->';

  let updatedContent;
  if (galeriaContent.includes(startTag) && galeriaContent.includes(endTag)) {
    const pattern = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
    updatedContent = galeriaContent.replace(pattern, `${startTag}\n${generatedHtml}\n        ${endTag}`);
  } else {
    const ulPattern = /<ul class="gallery-grid" role="list" data-gallery>[\s\S]*?<\/ul>/;
    const replacement = `<ul class="gallery-grid" role="list" data-gallery>\n${startTag}\n${generatedHtml}\n        ${endTag}\n        </ul>`;
    updatedContent = galeriaContent.replace(ulPattern, replacement);
  }

  fs.writeFileSync(GALERIA_HTML, updatedContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`[OK] Gallery updated successfully: ${items.length} total items in galeria.html.`);
}

if (require.main === module) {
  updateGallery();
}

module.exports = { updateGallery };
