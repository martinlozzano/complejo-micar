const PAGE_NAMES = ['cabanas', 'servicios', 'galeria', 'ubicacion', 'reserva'];
const ORIGIN = 'https://complejomicar.com';

// Editable documents stay flat for the image/gallery generators. Public documents
// use directory indexes and links relative to their own depth, including on project hosting.
function publicUrl(value, nested) {
  const prefix = nested ? '../' : '';
  const page = value.match(/^(index|cabanas|servicios|galeria|ubicacion|reserva)\.html([?#].*)?$/);
  if (page) return `${page[1] === 'index' ? nested ? '../' : './' : prefix + page[1] + '/'}${page[2] || ''}`;
  if (/^(?:assets|css|js|data)\//.test(value) || /^(?:llms|llms-full)\.txt(?:[?#]|$)/.test(value)) return prefix + value;
  return value;
}

function renderPage(html, nested = false) {
  return html.replace(/<[a-z][^>]*>/gi, (tag) => tag.replace(/\s(href|src|srcset|data-full|poster)="([^"]*)"/g, (attribute, name, value) => {
    const url = name === 'srcset'
      ? value.split(',').map((candidate) => candidate.trim().replace(/^\S+/, (source) => publicUrl(source, nested))).join(', ')
      : publicUrl(value, nested);
    return ` ${name}="${url}"`;
  }));
}

function legacyRedirect(page) {
  if (!PAGE_NAMES.includes(page)) throw new Error('Unknown legacy page.');
  return `<!doctype html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Complejo MICAR</title>
<link rel="canonical" href="${ORIGIN}/${page}/">
<meta http-equiv="refresh" content="0; url=${page}/">
<script>const target = new URL('${page}/', location.href); target.search = location.search; target.hash = location.hash; location.replace(target.href);</script>
</head><body><p>Esta página se trasladó. <a href="${page}/">Continuar a Complejo MICAR</a>.</p></body></html>
`;
}

module.exports = { PAGE_NAMES, renderPage, legacyRedirect };
