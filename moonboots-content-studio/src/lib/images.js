import { TOUCHLINE_COLOURS } from '../../shared/brand.js';

// Branded images made in the browser with a canvas.
// MoonBoots: its gradient themes and logo. Touchline: navy, the mark, Inter, touchline.xyz.

// Image themes per workspace
export const themesFor = (slug) => (slug === 'touchline' ? touchlineThemes : templateThemes);

export const templateThemes = {
  midnight: { name: 'Midnight', gradient: ['#0f172a', '#1e3a5f'], accent: '#3b82f6' },
  forest: { name: 'Forest', gradient: ['#064e3b', '#065f46'], accent: '#10b981' },
  sunset: { name: 'Sunset', gradient: ['#7c2d12', '#9a3412'], accent: '#f97316' },
  purple: { name: 'Purple', gradient: ['#3b0764', '#581c87'], accent: '#a855f7' },
  ocean: { name: 'Ocean', gradient: ['#0c4a6e', '#075985'], accent: '#0ea5e9' },
  charcoal: { name: 'Charcoal', gradient: ['#171717', '#262626'], accent: '#737373' },
};

// Touchline image themes. The mark is always white; the themes differ in the navy ground.
// "Navy glow" is the app icon's ground: lighter in the middle, darker at the edges.
const TOUCHLINE_GLOW = ['#16213A', '#080E1C'];

export const touchlineThemes = {
  'tl-navy': { name: 'Navy', gradient: [TOUCHLINE_COLOURS.navy, TOUCHLINE_COLOURS.navy], accent: TOUCHLINE_COLOURS.white },
  'tl-glow': { name: 'Navy glow', gradient: TOUCHLINE_GLOW, accent: TOUCHLINE_COLOURS.white, radial: true },
};

// Fill a Touchline image's ground: flat navy, or the app icon's glow
const paintTouchlineGround = (ctx, width, height, colours, radial) => {
  if (!radial) {
    ctx.fillStyle = colours[0];
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const grd = ctx.createRadialGradient(width * 0.5, height * 0.46, 0, width * 0.5, height * 0.46, Math.max(width, height) * 0.7);
  grd.addColorStop(0, colours[0]);
  grd.addColorStop(1, colours[1]);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);
};

// Draw the Touchline mark (viewBox 64 x 40) at x, y, `width` wide
export const drawTouchlineMark = (ctx, x, y, width, colour) => {
  const scale = width / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.arc(32, 32, 16, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 32);
  ctx.lineTo(58, 32);
  ctx.stroke();
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(32, 32, 5.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(32, 32, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Touchline template image: navy, the mark, the Inter wordmark and touchline.xyz. Never Moonboots branding.
const generateTouchlineTemplateImage = async (content, platform, theme) => {
  await Promise.all(['400', '600', '700'].map(weight => document.fonts.load(`${weight} 40px Inter`).catch(() => {})));

  const sizes = {
    instagram: { width: 1080, height: 1350 },
    linkedin: { width: 1200, height: 1200 },
    facebook: { width: 1200, height: 1200 },
    x: { width: 1200, height: 675 },
  };
  const { width, height } = sizes[platform] || sizes.linkedin;
  const t = touchlineThemes[theme] || touchlineThemes['tl-navy'];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const unit = Math.min(width, height) / 1080;
  const pad = Math.round(Math.min(width, height) * 0.08);

  paintTouchlineGround(ctx, width, height, t.gradient, t.radial);

  // Mark (always white) and wordmark
  const markWidth = 104 * unit;
  drawTouchlineMark(ctx, pad, pad, markWidth, TOUCHLINE_COLOURS.white);
  ctx.font = `400 ${Math.round(46 * unit)}px Inter, sans-serif`;
  ctx.fillStyle = TOUCHLINE_COLOURS.white;
  ctx.fillText('Touchline', pad + markWidth + 20 * unit, pad + 32 * (markWidth / 64));

  // Headline and body
  const paragraphs = content.split('\n').map(l => l.trim()).filter(Boolean);
  const maxWidth = width - pad * 2;
  let y = pad + 40 * (markWidth / 64) + 96 * unit;
  ctx.fillStyle = TOUCHLINE_COLOURS.green;
  ctx.fillRect(pad, y - 44 * unit, 88 * unit, 8 * unit);

  const headlineSize = Math.round(52 * unit);
  ctx.font = `700 ${headlineSize}px Inter, sans-serif`;
  ctx.fillStyle = TOUCHLINE_COLOURS.white;
  for (const line of wrapText(ctx, paragraphs[0] || '', maxWidth).slice(0, 5)) {
    y += headlineSize * 1.2;
    ctx.fillText(line, pad, y);
  }

  const bodySize = Math.round(30 * unit);
  const footerY = height - pad;
  ctx.font = `400 ${bodySize}px Inter, sans-serif`;
  ctx.fillStyle = '#B8C4D6';
  y += bodySize;
  for (const para of paragraphs.slice(1)) {
    if (y > footerY - bodySize * 3) break;
    for (const line of wrapText(ctx, para, maxWidth)) {
      if (y > footerY - bodySize * 3) break;
      y += bodySize * 1.4;
      ctx.fillText(line, pad, y);
    }
    y += bodySize * 0.6;
  }

  ctx.font = `600 ${Math.round(32 * unit)}px Inter, sans-serif`;
  ctx.fillStyle = TOUCHLINE_COLOURS.green;
  ctx.fillText('touchline.xyz', pad, footerY);

  return canvas.toDataURL('image/png');
};

// Generate template-based image using canvas
export const generateTemplateImage = async (content, template, platform, theme = 'midnight', brand = 'moonboots') => {
  if (brand === 'touchline') return generateTouchlineTemplateImage(content, platform, theme);
  const canvas = document.createElement('canvas');

  // Platform-optimized sizes
  const sizes = {
    instagram: { width: 1080, height: 1350 },  // 4:5 portrait for feed
    linkedin: { width: 1200, height: 1200 },   // Square performs well
    x: { width: 1200, height: 675 },           // 16:9 for timeline
  };
  const { width, height } = sizes[platform] || sizes.linkedin;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Parse content - preserve paragraph structure
  const paragraphs = content.split('\n').filter(l => l.trim());
  const headline = paragraphs[0] || '';
  const bodyParagraphs = paragraphs.slice(1);

  // Theme colors
  const themeColors = {
    midnight: { gradient: ['#0f172a', '#1e3a5f'], accent: '#3b82f6' },
    forest: { gradient: ['#064e3b', '#065f46'], accent: '#10b981' },
    sunset: { gradient: ['#7c2d12', '#9a3412'], accent: '#f97316' },
    purple: { gradient: ['#3b0764', '#581c87'], accent: '#a855f7' },
    ocean: { gradient: ['#0c4a6e', '#075985'], accent: '#0ea5e9' },
    charcoal: { gradient: ['#171717', '#262626'], accent: '#737373' },
  };

  const t = themeColors[theme] || themeColors.midnight;

  // Draw gradient background
  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, t.gradient[0]);
  grd.addColorStop(1, t.gradient[1]);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  // Add subtle pattern
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < width; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Draw accent line
  ctx.fillStyle = t.accent;
  ctx.fillRect(60, 80, 6, 100);

  // Load and draw actual logo
  try {
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      logo.onload = resolve;
      logo.onerror = reject;
      logo.src = '/moonboots-logo.png';
    });
    const logoHeight = 40;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    ctx.drawImage(logo, width - logoWidth - 60, 60, logoWidth, logoHeight);
  } catch {
    ctx.font = 'bold 24px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('moonboots', width - 180, 85);
  }

  // Calculate font sizes based on canvas size
  const scale = Math.min(width, height) / 1080;
  const headlineFontSize = Math.round(42 * scale);
  const bodyFontSize = Math.round(26 * scale);
  const padding = 80;
  const maxWidth = width - padding * 2;

  // Draw headline
  ctx.font = `bold ${headlineFontSize}px system-ui`;
  ctx.fillStyle = '#ffffff';
  const headlineLines = wrapText(ctx, headline, maxWidth);
  let y = 180;
  const headlineLineHeight = headlineFontSize * 1.3;
  headlineLines.slice(0, 5).forEach(line => {
    ctx.fillText(line, padding, y);
    y += headlineLineHeight;
  });

  // Draw body paragraphs with proper spacing
  if (bodyParagraphs.length > 0) {
    ctx.font = `${bodyFontSize}px system-ui`;
    ctx.fillStyle = '#94a3b8';
    const bodyLineHeight = bodyFontSize * 1.4;
    const paragraphSpacing = bodyFontSize * 0.8;
    y += 25;

    const footerY = height - 60;

    for (const para of bodyParagraphs) {
      if (y > footerY - bodyLineHeight * 2) break; // Stop before footer

      const lines = wrapText(ctx, para, maxWidth);
      for (const line of lines) {
        if (y > footerY - bodyLineHeight) break;
        ctx.fillText(line, padding, y);
        y += bodyLineHeight;
      }
      y += paragraphSpacing; // Space between paragraphs
    }
  }

  // Footer
  ctx.font = '14px system-ui';
  ctx.fillStyle = '#64748b';
  ctx.fillText('moonbootslabs.com', padding, height - 40);

  return canvas.toDataURL('image/png');
};

// Text wrapping helper
export const wrapText = (ctx, text, maxWidth) => {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
};


// ============ QUOTE CARDS (Graphics page) ============

export const QUOTE_SIZES = {
  square: { label: 'Square', width: 1080, height: 1080 },
  portrait: { label: 'Portrait', width: 1080, height: 1350 },
  landscape: { label: 'Landscape', width: 1200, height: 675 },
};

export const quoteStylesFor = (slug) => (slug === 'touchline'
  ? {
    navy: { name: 'Navy', bg: [TOUCHLINE_COLOURS.navy, TOUCHLINE_COLOURS.navy], text: '#FFFFFF', footer: TOUCHLINE_COLOURS.green, mark: TOUCHLINE_COLOURS.white },
    glow: { name: 'Navy glow', bg: TOUCHLINE_GLOW, radial: true, text: '#FFFFFF', footer: TOUCHLINE_COLOURS.green, mark: TOUCHLINE_COLOURS.white },
  }
  : {
    dark: { name: 'Dark', bg: ['#0f172a', '#0f172a'], text: '#FFFFFF', footer: '#94a3b8', mark: '#FFFFFF' },
    light: { name: 'Light', bg: ['#FFFFFF', '#FFFFFF'], text: '#0f172a', footer: '#64748b', mark: '#0f172a' },
    gradient: { name: 'Gradient', bg: ['#0f172a', '#1e3a8a'], text: '#FFFFFF', footer: '#cbd5e1', mark: '#FFFFFF' },
  });

const loadFonts = (family, weights) => Promise.all(
  weights.map(weight => document.fonts.load(`${weight} 40px "${family}"`).catch(() => {})),
);

// A quote card as a PNG data URL, in the workspace's own branding
export const renderQuoteCard = async ({ quote, brand, style, size = 'square' }) => {
  const touchline = brand === 'touchline';
  const styles = quoteStylesFor(brand);
  const s = styles[style] || Object.values(styles)[0];
  const { width, height } = QUOTE_SIZES[size] || QUOTE_SIZES.square;
  const family = touchline ? 'Inter' : 'DM Sans';
  await loadFonts(family, touchline ? ['400', '600', '700'] : ['300', '500']);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const unit = Math.min(width, height) / 1080;
  const pad = Math.round(Math.min(width, height) * 0.08);

  if (s.radial) {
    paintTouchlineGround(ctx, width, height, s.bg, true);
  } else {
    const grd = ctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, s.bg[0]);
    grd.addColorStop(1, s.bg[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
  }

  // Brand row
  if (touchline) {
    const markWidth = 104 * unit;
    drawTouchlineMark(ctx, pad, pad, markWidth, s.mark);
    ctx.font = `400 ${Math.round(46 * unit)}px Inter, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Touchline', pad + markWidth + 20 * unit, pad + 32 * (markWidth / 64));
  } else {
    const r = 22 * unit;
    const cx = pad + r;
    const cy = pad + r;
    ctx.fillStyle = s.mark;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.bg[0];
    ctx.beginPath();
    ctx.arc(cx + r * 0.35, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `500 ${Math.round(36 * unit)}px "DM Sans", sans-serif`;
    ctx.fillStyle = s.text;
    ctx.fillText('moonboots', pad + r * 2 + 16 * unit, cy + 12 * unit);
  }

  // Quote, as large as fits
  const text = (quote || '').trim() || 'Your quote here';
  const maxWidth = width - pad * 2;
  const top = pad + 140 * unit;
  const bottom = height - pad - 90 * unit;
  let fontSize = (touchline ? 72 : 64) * unit;
  let lines;
  const fontFor = sizePx => (touchline ? `700 ${sizePx}px Inter, sans-serif` : `300 ${sizePx}px "DM Sans", sans-serif`);
  for (;;) {
    ctx.font = fontFor(Math.round(fontSize));
    lines = text.split('\n').flatMap(paragraph => wrapText(ctx, paragraph, maxWidth));
    if (lines.length * fontSize * 1.3 <= bottom - top || fontSize <= 28 * unit) break;
    fontSize -= 4 * unit;
  }
  const lineHeight = fontSize * 1.3;
  let y = top + Math.max(0, (bottom - top - lines.length * lineHeight) / 2) + fontSize;
  ctx.fillStyle = s.text;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += lineHeight;
  }

  // Footer
  ctx.font = touchline ? `600 ${Math.round(32 * unit)}px Inter, sans-serif` : `400 ${Math.round(28 * unit)}px "DM Sans", sans-serif`;
  ctx.fillStyle = s.footer;
  ctx.fillText(touchline ? 'touchline.xyz' : 'moonbootsconsultancy.net', pad, height - pad);

  return canvas.toDataURL('image/png');
};
