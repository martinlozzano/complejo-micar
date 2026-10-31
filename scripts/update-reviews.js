#!/usr/bin/env node

/**
 * Complejo MICAR - Automatic Reviews / Testimonials Generator
 * Reads data/reviews.json and injects the testimonials HTML into index.html.
 */

const fs = require('fs');
const path = require('path');

const SITE_DIR = path.resolve(__dirname, '..');
const REVIEWS_FILE = path.join(SITE_DIR, 'data/reviews.json');
const INDEX_HTML = path.join(SITE_DIR, 'index.html');

const STAR_SVG = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStayText(review) {
  if (review.stay) {
    return ` · ${escapeHtml(review.stay)}`;
  }
  if (!review.unit) return '';

  const unit = review.unit.trim();
  if (/^hospedad/i.test(unit)) {
    return ` · ${escapeHtml(unit)}`;
  }

  const firstName = (review.author || '').trim().split(/\s+/)[0].toLowerCase();
  const isFeminine = firstName.endsWith('a') || ['carmen', 'mercedes', 'belen', 'inés', 'ines'].includes(firstName);
  const verb = isFeminine ? 'Hospedada' : 'Hospedado';
  return ` · ${verb} en ${escapeHtml(unit)}`;
}

function generateReviewHtml(review, index) {
  const isActive = index === 0 ? ' is-active' : '';
  const cleanQuote = (review.text || '').trim().replace(/^[“”"]+|[“”"]+$/g, '');
  const rating = Math.min(5, Math.max(1, Number(review.rating) || 5));
  const starsHtml = Array(rating).fill(STAR_SVG).join('\n                ');
  const stayText = getStayText(review);

  return `            <figure class="testimonial${isActive}">\n` +
         `              <blockquote class="testimonial__quote">“${escapeHtml(cleanQuote)}”</blockquote>\n` +
         `              <div class="testimonial__stars" role="img" aria-label="${rating} de 5 estrellas">\n` +
         `                ${starsHtml}\n` +
         `              </div>\n` +
         `              <figcaption class="testimonial__author">\n` +
         `                <strong>${escapeHtml(review.author || 'Huésped')}</strong>${stayText}\n` +
         `              </figcaption>\n` +
         `            </figure>`;
}

function updateReviews() {
  if (!fs.existsSync(REVIEWS_FILE)) {
    console.error(`[ERROR] File not found: ${REVIEWS_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`[ERROR] File not found: ${INDEX_HTML}`);
    process.exit(1);
  }

  let reviews = [];
  try {
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf8');
    reviews = JSON.parse(raw);
  } catch (err) {
    console.error(`[ERROR] Failed to parse ${REVIEWS_FILE}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(reviews) || reviews.length === 0) {
    console.error(`[ERROR] ${REVIEWS_FILE} must contain a non-empty array of reviews.`);
    process.exit(1);
  }

  const generatedItemsHtml = reviews.map((r, i) => generateReviewHtml(r, i)).join('\n\n');

  let htmlContent = fs.readFileSync(INDEX_HTML, 'utf8');
  const isCRLF = htmlContent.includes('\r\n');
  const normalizedHtml = htmlContent.replace(/\r\n/g, '\n');

  const startTag = '<!-- REVIEWS_START -->';
  const endTag = '<!-- REVIEWS_END -->';

  let updatedHtml;
  if (normalizedHtml.includes(startTag) && normalizedHtml.includes(endTag)) {
    const pattern = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
    updatedHtml = normalizedHtml.replace(pattern, `${startTag}\n${generatedItemsHtml}\n          ${endTag}`);
  } else {
    const trackPattern = /(<div class="testimonial-slider__track"[^>]*>)[\s\S]*?(<\/div>\s*<button[^>]*data-testimonial-next)/;
    if (!trackPattern.test(normalizedHtml)) {
      console.error('[ERROR] Could not find .testimonial-slider__track boundary in index.html');
      process.exit(1);
    }
    updatedHtml = normalizedHtml.replace(
      trackPattern,
      `$1\n          ${startTag}\n${generatedItemsHtml}\n          ${endTag}\n          $2`
    );
  }

  const finalOutput = isCRLF ? updatedHtml.replace(/\n/g, '\r\n') : updatedHtml;
  fs.writeFileSync(INDEX_HTML, finalOutput, 'utf8');
  console.log(`[OK] Successfully updated index.html with ${reviews.length} reviews from reviews.json.`);
}

if (require.main === module) {
  updateReviews();
}

module.exports = { updateReviews };
