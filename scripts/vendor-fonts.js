const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function vendorFonts() {
  const output = path.join(ROOT, 'assets/fonts');
  await fs.mkdir(output, { recursive: true });
  for (const [family, styles] of [['inter', ['normal']], ['playfair-display', ['normal', 'italic']]]) {
    const source = path.join(ROOT, 'node_modules/@fontsource-variable', family);
    for (const style of styles) {
      const filename = `${family}-latin-wght-${style}.woff2`;
      await fs.copyFile(path.join(source, 'files', filename), path.join(output, filename));
    }
    await fs.copyFile(path.join(source, 'LICENSE'), path.join(output, `${family}-OFL.txt`));
  }
  console.log('Vendored Latin WOFF2 fonts and their OFL licenses.');
}

if (require.main === module) vendorFonts().catch((error) => { console.error(error); process.exitCode = 1; });
