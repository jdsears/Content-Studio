import sharp from 'sharp';
import opentype from 'opentype.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { TOUCHLINE_COLOURS, touchlineMarkSvg, checkContent } from '../shared/brand.js';
import { askClaude, claudeApiKey } from './claude.js';

// ============ BRANDED IMAGE CARDS (Touchline) ============
// Text is drawn as shapes from the bundled Inter font, so cards look the same on any server.

const require = createRequire(import.meta.url);
const fonts = {};

function interFont(weight) {
  if (!fonts[weight]) {
    const buffer = readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
    fonts[weight] = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }
  return fonts[weight];
}

export const CARD_SIZES = {
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 1200 },
  facebook: { width: 1200, height: 1200 },
  x: { width: 1200, height: 675 },
};

// Drop characters the font can't draw (emoji and the like)
function drawable(font, text) {
  return [...String(text)].filter(ch => /\s/.test(ch) || font.charToGlyphIndex(ch) > 0).join('').replace(/\s+/g, ' ').trim();
}

function wrapLines(font, text, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.getAdvanceWidth(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const textPath = (font, text, x, y, size, fill) =>
  `<path d="${font.getPath(text, x, y, size).toPathData(2)}" fill="${fill}"/>`;

export function touchlineCardSvg({ headline, platform, markColour = TOUCHLINE_COLOURS.white }) {
  const { width, height } = CARD_SIZES[platform] || CARD_SIZES.linkedin;
  const { navy, green, white } = TOUCHLINE_COLOURS;
  const unit = Math.min(width, height) / 1080;
  const pad = Math.round(Math.min(width, height) * 0.08);
  const regular = interFont(400);
  const semibold = interFont(600);
  const bold = interFont(700);

  // Brand row: the mark, then the "Touchline" wordmark in Inter regular
  const markWidth = 104 * unit;
  const markScale = markWidth / 64;
  const markHeight = 40 * markScale;
  const wordSize = 46 * unit;
  const wordBaseline = pad + 32 * markScale;
  const brandRow = `<g transform="translate(${pad} ${pad}) scale(${markScale})">${touchlineMarkSvg(markColour)}</g>`
    + textPath(regular, 'Touchline', pad + markWidth + 20 * unit, wordBaseline, wordSize, white);

  // Footer
  const footerSize = 32 * unit;
  const footer = textPath(semibold, 'touchline.xyz', pad, height - pad, footerSize, green);

  // Headline: as large as fits between the brand row and the footer
  const text = drawable(bold, headline);
  const top = pad + markHeight + 72 * unit;
  const bottom = height - pad - footerSize - 56 * unit;
  const maxWidth = width - pad * 2;
  let size = (height > width * 0.7 ? 88 : 100) * unit;
  let lines = wrapLines(bold, text, size, maxWidth);
  while (size > 36 * unit && (lines.length * size * 1.18 > bottom - top || lines.length > 6)) {
    size -= 4 * unit;
    lines = wrapLines(bold, text, size, maxWidth);
  }
  const lineHeight = size * 1.18;
  const blockTop = top + Math.max(0, (bottom - top - lines.length * lineHeight) / 2);
  const headlinePaths = lines
    .map((line, i) => textPath(bold, line, pad, blockTop + size + i * lineHeight, size, white))
    .join('');
  const accent = `<rect x="${pad}" y="${blockTop - 36 * unit}" width="${88 * unit}" height="${8 * unit}" rx="${4 * unit}" fill="${green}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${navy}"/>`
    + brandRow + accent + headlinePaths + footer
    + '</svg>';
}

export async function renderTouchlineCard(options) {
  const png = await sharp(Buffer.from(touchlineCardSvg(options))).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// A short headline taken from the post itself, used when Claude isn't available
export function fallbackHeadline(content) {
  const plain = String(content || '')
    .replace(/https?:\/\/\S+|\b\S+\.(?:xyz|com|net|co\.uk)\/\S*/gi, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const firstSentence = plain.split(/(?<=[.!?])\s/)[0] || plain;
  const words = firstSentence.split(' ');
  return words.length > 16 ? `${words.slice(0, 16).join(' ')}…` : firstSentence;
}

export async function cardHeadline(post) {
  const fallback = fallbackHeadline(post.content);
  if (!claudeApiKey()) return fallback;
  try {
    const reply = await askClaude({
      purpose: 'drafting',
      maxTokens: 4000,
      prompt: `Write a headline of at most 9 words for an image card that goes with this ${post.platform} post for Touchline, the all-in-one grassroots football app.
Rules: British English. Use only what the post itself says. No dashes, hashtags, emoji or quotation marks.

Post:
${post.content}

Reply with the headline only.`,
    });
    const headline = reply.split('\n')[0].replace(/^["'“‘]|["'”’]$/g, '').trim();
    // Never put a dash or a banned claim on a card
    if (!headline || checkContent('touchline', headline).length) return fallback;
    return headline;
  } catch (error) {
    console.error('Card headline from Claude failed, using the post\'s first sentence:', error.message);
    return fallback;
  }
}

// The image for a post created through the API with generateImage: true
export async function makePostImage(workspace, post) {
  if (workspace.slug !== 'touchline') {
    throw new Error('Image cards are set up for Touchline only.');
  }
  // The mark is always white now, whatever imageStyle says
  return renderTouchlineCard({ headline: await cardHeadline(post), platform: post.platform });
}
