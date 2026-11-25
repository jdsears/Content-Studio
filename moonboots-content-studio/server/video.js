import sharp from 'sharp';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';
import { TOUCHLINE_COLOURS, touchlineMarkSvg, checkContent } from '../shared/brand.js';
import { interFont, drawable, wrapLines, textPath } from './cards.js';

// ============ SHORT BRANDED VIDEOS (Touchline) ============
// A 9 to 13 second clip in Touchline's look, made from a few lines of text and
// one real Touchline screen: the lines build up, the screen rises into view in
// a phone (or a browser frame for wide screens), then an end card with the
// link. Silent, so it works with the sound off, which is how most people
// scroll. Frames are drawn with the same fonts as the image cards and joined
// into an MP4 with ffmpeg.

export const VIDEO_SIZES = {
  facebook: { width: 1080, height: 1350 },
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1080, height: 1350 },
};
const FPS = 30;

// Screens only come from Touchline's own site (no fetching arbitrary addresses)
const SCREEN_HOSTS = (process.env.VIDEO_SCREEN_HOSTS || 'touchline.xyz,www.touchline.xyz').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);

export class VideoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

/** Whether ffmpeg is installed here, for the health check. */
export function ffmpegAvailable() {
  return new Promise(resolve => {
    const child = spawn(ffmpegPath(), ['-version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', code => resolve(code === 0));
  });
}

const easeOut = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const clamp01 = t => Math.min(Math.max(t, 0), 1);

/** Check what a clip is asked to show. Pure. Returns the cleaned spec or throws. */
export function validateSpec({ platform = 'facebook', lines, screenUrl, cta } = {}) {
  if (!VIDEO_SIZES[platform]) throw new VideoError(`Videos are for ${Object.keys(VIDEO_SIZES).join(', ')}`);
  const clean = (Array.isArray(lines) ? lines : []).map(l => String(l || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (clean.length < 2 || clean.length > 4) throw new VideoError('A video needs 2 to 4 lines of text');
  if (clean.some(l => l.length > 70)) throw new VideoError('Keep each line under 70 characters so it can be read in time');
  const ctaLine = String(cta || 'Your first month of Pro is free.').replace(/\s+/g, ' ').trim().slice(0, 60);
  const problems = [...clean, ctaLine].flatMap(text => checkContent('touchline', text));
  if (problems.length) throw new VideoError(`Not allowed on screen: ${problems.map(p => p.message).join('; ')}`);
  let url;
  try { url = new URL(String(screenUrl || '')); } catch { throw new VideoError('screenUrl must be a link to a Touchline screen'); }
  if (url.protocol !== 'https:' || !SCREEN_HOSTS.includes(url.hostname.toLowerCase())) {
    throw new VideoError(`Screens must come from ${SCREEN_HOSTS.join(' or ')}`);
  }
  return { platform, lines: clean, screenUrl: url.toString(), cta: ctaLine };
}

/** The clip's timeline in seconds, from the number of lines. Pure. */
export function timeline(lineCount) {
  const lineStep = 1.5;
  const lines = Array.from({ length: lineCount }, (_, i) => 0.35 + i * lineStep);
  const screen = lines[lineCount - 1] + 1.2;
  const end = screen + 3.4;
  return { lines, screen, end, total: end + 2.4 };
}

async function fetchScreen(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new VideoError(`The screen at ${url} answered ${res.status}`, 502);
  const type = res.headers.get('content-type') || '';
  if (!/^image\/(png|jpe?g|webp)/i.test(type)) throw new VideoError(`The screen at ${url} isn't an image (${type || 'no type'})`, 502);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 8 * 1024 * 1024) throw new VideoError('The screen image is too large', 413);
  return buffer;
}

// The screen in a device frame, as a PNG with transparency
async function framedScreen(buffer, width) {
  const meta = await sharp(buffer).metadata();
  const portrait = (meta.height || 1) > (meta.width || 1);
  const { navy } = TOUCHLINE_COLOURS;
  if (portrait) {
    // Phone: dark bezel, rounded screen, a notch
    const phoneWidth = Math.round(width * 0.54);
    const bezel = Math.round(phoneWidth * 0.035);
    const screenWidth = phoneWidth - bezel * 2;
    const screen = await sharp(buffer).resize({ width: screenWidth }).png().toBuffer();
    const screenHeight = (await sharp(screen).metadata()).height;
    const phoneHeight = screenHeight + bezel * 2;
    const radius = Math.round(phoneWidth * 0.12);
    const inner = radius - bezel;
    const mask = Buffer.from(`<svg width="${screenWidth}" height="${screenHeight}"><rect width="${screenWidth}" height="${screenHeight}" rx="${inner}" fill="#fff"/></svg>`);
    const rounded = await sharp(screen).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const body = Buffer.from(`<svg width="${phoneWidth}" height="${phoneHeight}">`
      + `<rect width="${phoneWidth}" height="${phoneHeight}" rx="${radius}" fill="#1B2433" stroke="#2C3A52" stroke-width="3"/>`
      + `</svg>`);
    const notch = Buffer.from(`<svg width="${phoneWidth}" height="${phoneHeight}"><rect x="${phoneWidth / 2 - phoneWidth * 0.14}" y="${bezel + 10}" width="${phoneWidth * 0.28}" height="${bezel * 1.6}" rx="${bezel * 0.8}" fill="#0A0F18"/></svg>`);
    const png = await sharp(body).composite([{ input: rounded, top: bezel, left: bezel }, { input: notch }]).png().toBuffer();
    return { png, width: phoneWidth, height: phoneHeight, portrait };
  }
  // Wide screen: a browser-style card
  const cardWidth = Math.round(width * 0.86);
  const bar = Math.round(cardWidth * 0.045);
  const screen = await sharp(buffer).resize({ width: cardWidth }).png().toBuffer();
  const screenHeight = (await sharp(screen).metadata()).height;
  const cardHeight = screenHeight + bar;
  const radius = Math.round(cardWidth * 0.025);
  const frame = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}">`
    + `<rect width="${cardWidth}" height="${cardHeight}" rx="${radius}" fill="#1B2433"/>`
    + [0, 1, 2].map(i => `<circle cx="${bar * 0.7 + i * bar * 0.55}" cy="${bar / 2}" r="${bar * 0.16}" fill="#3A4A66"/>`).join('')
    + `</svg>`);
  const mask = Buffer.from(`<svg width="${cardWidth}" height="${screenHeight}"><rect width="${cardWidth}" height="${screenHeight}" rx="${radius}" fill="#fff"/><rect width="${cardWidth}" height="${radius}" fill="#fff"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const png = await sharp(frame).composite([{ input: rounded, top: bar, left: 0 }]).png().toBuffer();
  void navy;
  return { png, width: cardWidth, height: cardHeight, portrait };
}

// Text layout for the lines, worked out once
function layoutLines(lines, width) {
  const bold = interFont(700);
  const pad = Math.round(width * 0.085);
  const maxWidth = width - pad * 2;
  const top = 250;
  const bottom = 640;
  let size = 76;
  const wrap = s => lines.map(l => wrapLines(bold, drawable(bold, l), s, maxWidth));
  let wrapped = wrap(size);
  const height = (w, s) => w.reduce((n, rows) => n + rows.length * s * 1.16, 0) + (w.length - 1) * s * 0.42;
  while (size > 44 && height(wrapped, size) > bottom - top) {
    size -= 4;
    wrapped = wrap(size);
  }
  const blocks = [];
  let y = top;
  for (const rows of wrapped) {
    blocks.push({ rows, y });
    y += rows.length * size * 1.16 + size * 0.42;
  }
  return { bold, pad, size, blocks };
}

// One frame's text and branding as SVG
function frameSvg({ width, height, t, plan, layout, cta }) {
  const { navy, green, white } = TOUCHLINE_COLOURS;
  const regular = interFont(400);
  const semibold = interFont(600);
  const { bold, pad, size, blocks } = layout;
  const parts = [`<rect width="${width}" height="${height}" fill="${navy}"/>`];

  // Faint pitch markings drifting slowly, and a green glow that rises with the screen
  const drift = (t * 6).toFixed(1);
  parts.push(`<g opacity="0.06" stroke="${white}" stroke-width="3" fill="none" transform="translate(0 ${drift})">`
    + `<line x1="0" y1="${height * 0.62}" x2="${width}" y2="${height * 0.62}"/>`
    + `<circle cx="${width / 2}" cy="${height * 0.62}" r="${width * 0.24}"/>`
    + `<circle cx="${width / 2}" cy="${height * 0.62}" r="6" fill="${white}"/>`
    + `</g>`);
  const glow = 0.18 + 0.32 * easeOut((t - plan.screen) / 0.9);
  parts.push(`<defs><radialGradient id="g" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="${green}" stop-opacity="${glow.toFixed(3)}"/><stop offset="1" stop-color="${green}" stop-opacity="0"/></radialGradient></defs>`
    + `<rect x="0" y="${height * 0.45}" width="${width}" height="${height * 0.55}" fill="url(#g)"/>`);

  // Brand row, fading in
  const brandOpacity = easeOut(t / 0.4);
  parts.push(`<g opacity="${brandOpacity.toFixed(3)}"><g transform="translate(${pad} 92) scale(1.45)">${touchlineMarkSvg(white)}</g>`
    + textPath(regular, 'Touchline', pad + 108, 138, 44, white) + '</g>');

  // Accent bar grows with the first line
  const accent = easeOut((t - plan.lines[0]) / 0.5);
  parts.push(`<rect x="${pad}" y="${blocks[0].y - 34}" width="${(96 * accent).toFixed(1)}" height="8" rx="4" fill="${green}"/>`);

  // Lines rise and fade in one after another; the newest is brightest
  blocks.forEach((block, i) => {
    const p = easeOut((t - plan.lines[i]) / 0.45);
    if (p <= 0) return;
    const newest = i === blocks.filter((_, j) => t >= plan.lines[j]).length - 1;
    const opacity = p * (newest || t < plan.screen ? 1 : 0.72);
    const dy = (1 - p) * 36;
    const rows = block.rows.map((row, r) => textPath(bold, row, pad, block.y + size + r * size * 1.16 + dy, size, white)).join('');
    parts.push(`<g opacity="${opacity.toFixed(3)}">${rows}</g>`);
  });

  // Footer link until the screen comes up over it
  const footer = 1 - clamp01((t - plan.screen) / 0.3);
  if (footer > 0) parts.push(`<g opacity="${footer.toFixed(3)}">${textPath(semibold, 'touchline.xyz', pad, height - 70, 30, green)}</g>`);
  void cta;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
}

// The end card, at a given opacity, as SVG
function endCardSvg({ width, height, opacity, cta }) {
  const { navy, green, white } = TOUCHLINE_COLOURS;
  const bold = interFont(700);
  const regular = interFont(400);
  const semibold = interFont(600);
  const markScale = 3.2;
  const markWidth = 64 * markScale;
  const word = 'Touchline';
  const wordSize = 72;
  const wordWidth = regular.getAdvanceWidth(word, wordSize);
  const ctaSize = 46;
  const ctaRows = wrapLines(bold, drawable(bold, cta), ctaSize, width * 0.8);
  const linkSize = 40;
  const link = 'touchline.xyz';
  const centre = (font, text, s) => (width - font.getAdvanceWidth(text, s)) / 2;
  const cy = height * 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<g opacity="${opacity.toFixed(3)}"><rect width="${width}" height="${height}" fill="${navy}"/>`
    + `<g transform="translate(${(width - markWidth) / 2} ${cy - 40 * markScale - 30}) scale(${markScale})">${touchlineMarkSvg(white)}</g>`
    + textPath(regular, word, (width - wordWidth) / 2, cy + 60, wordSize, white)
    + ctaRows.map((row, i) => textPath(bold, row, centre(bold, row, ctaSize), cy + 190 + i * ctaSize * 1.2, ctaSize, white)).join('')
    + textPath(semibold, link, centre(semibold, link, linkSize), cy + 200 + ctaRows.length * ctaSize * 1.2 + 40, linkSize, green)
    + '</g></svg>';
}

/**
 * Render a clip. Returns { buffer (MP4), durationSec, width, height }.
 * spec: { platform, lines: [2-4 strings], screenUrl (a touchline.xyz image), cta? }
 */
export async function renderClip(input, { fetchImage = fetchScreen } = {}) {
  const spec = validateSpec(input);
  const { width, height } = VIDEO_SIZES[spec.platform];
  const plan = timeline(spec.lines.length);
  const layout = layoutLines(spec.lines, width);
  const device = await framedScreen(await fetchImage(spec.screenUrl), width);
  const restingTop = Math.min(700, height - Math.round(device.height * (device.portrait ? 0.5 : 1)) - 60);
  const left = Math.round((width - device.width) / 2);
  const frames = Math.round(plan.total * FPS);

  const out = join(tmpdir(), `clip-${crypto.randomBytes(6).toString('hex')}.mp4`);
  const ffmpeg = spawn(ffmpegPath(), [
    '-v', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '22',
    '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  ffmpeg.stderr.on('data', d => { stderr += d; });
  const finished = new Promise((resolve, reject) => {
    ffmpeg.on('error', error => reject(new VideoError(error.code === 'ENOENT' ? 'ffmpeg is not installed on this server' : error.message, 503)));
    ffmpeg.on('exit', code => (code === 0 ? resolve() : reject(new VideoError(`ffmpeg failed: ${stderr.slice(-300)}`, 500))));
  });
  let pipeError = null;
  ffmpeg.stdin.on('error', error => { pipeError = error; });
  const write = chunk => new Promise((resolve, reject) => {
    if (pipeError) return reject(pipeError);
    if (ffmpeg.stdin.write(chunk)) return resolve();
    ffmpeg.stdin.once('drain', resolve);
  });

  // Frames that look the same as the last one (the holds between moves, the
  // end card once it has faded in) reuse it instead of being drawn again
  let lastKey = null;
  let lastFrame = null;

  try {
    for (let f = 0; f < frames; f++) {
      const t = f / FPS;
      const layers = [];
      const svg = frameSvg({ width, height, t, plan, layout, cta: spec.cta });
      // The screen rises in, then drifts up a touch
      if (t >= plan.screen) {
        const rise = easeOut((t - plan.screen) / 0.7);
        const drift = clamp01((t - plan.screen - 0.7) / (plan.end - plan.screen)) * 24;
        const top = Math.round(height + (restingTop - height) * rise - drift);
        const visible = Math.min(device.height, height - top);
        if (visible > 0 && top < height) {
          const piece = visible < device.height
            ? await sharp(device.png).extract({ left: 0, top: 0, width: device.width, height: visible }).toBuffer()
            : device.png;
          layers.push({ input: piece, top, left });
        }
      }
      // End card fades over everything
      if (t >= plan.end) {
        const opacity = clamp01((t - plan.end) / 0.45);
        layers.push({ input: Buffer.from(endCardSvg({ width, height, opacity, cta: spec.cta })), top: 0, left: 0 });
      }
      const endOpaque = t >= plan.end + 0.45;
      const key = endOpaque ? 'end' : `${svg.length}:${crypto.createHash('sha1').update(svg).digest('hex')}:${layers.map(l => l.top).join(',')}`;
      if (key !== lastKey) {
        lastFrame = await sharp(Buffer.from(endOpaque ? endCardSvg({ width, height, opacity: 1, cta: spec.cta }) : svg))
          .composite(endOpaque ? [] : layers)
          .flatten({ background: TOUCHLINE_COLOURS.navy })
          .removeAlpha()
          .raw()
          .toBuffer();
        lastKey = key;
      }
      await write(lastFrame);
    }
    ffmpeg.stdin.end();
    await finished;
    const buffer = await fs.readFile(out);
    return { buffer, durationSec: Math.round(plan.total * 10) / 10, width, height };
  } catch (error) {
    try { ffmpeg.kill('SIGKILL'); } catch { /* already gone */ }
    throw error;
  } finally {
    fs.unlink(out).catch(() => {});
  }
}
