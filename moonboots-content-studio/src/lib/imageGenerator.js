// Image generation utility for social media posts
// Generates branded images for different platforms and templates

const platformDimensions = {
  instagram: { width: 1080, height: 1350 }, // 4:5
  x: { width: 1200, height: 675 },          // 16:9
  linkedin: { width: 1200, height: 627 },   // 1.91:1
};

const styleConfigs = {
  dark: { bg: '#0f172a', text: '#ffffff', accent: '#94a3b8', gradient: null },
  light: { bg: '#ffffff', text: '#0f172a', accent: '#64748b', gradient: null },
  gradient: { bg: '#0f172a', text: '#ffffff', accent: '#cbd5e1', gradient: ['#0f172a', '#1e3a5f'] },
  vibrant: { bg: '#0f172a', text: '#ffffff', accent: '#a78bfa', gradient: ['#4f46e5', '#7c3aed'] },
};

// Text wrapping helper
const wrapText = (ctx, text, maxWidth) => {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  return lines;
};

// Draw moonboots logo
const drawMoonLogo = (ctx, x, y, config, size = 14) => {
  ctx.fillStyle = config.text;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = config.gradient ? config.gradient[0] : config.bg;
  ctx.beginPath();
  ctx.arc(x + size * 0.57, y - size * 0.14, size * 0.86, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * Generate a quote card image
 * @param {Object} options
 * @param {string} options.content - The quote/text content
 * @param {string} options.platform - 'instagram' | 'x' | 'linkedin'
 * @param {string} options.style - 'dark' | 'light' | 'gradient' | 'vibrant'
 * @returns {string} Data URL of the generated image
 */
export function generateQuoteImage({ content, platform = 'instagram', style = 'gradient' }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const { width, height } = platformDimensions[platform] || platformDimensions.instagram;
  const config = styleConfigs[style] || styleConfigs.gradient;

  canvas.width = width;
  canvas.height = height;

  // Background
  if (config.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, config.gradient[0]);
    gradient.addColorStop(1, config.gradient[1]);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = config.bg;
  }
  ctx.fillRect(0, 0, width, height);

  const padding = Math.min(width, height) * 0.055;
  const logoY = padding + 30;

  // Draw logo
  drawMoonLogo(ctx, padding + 14, logoY, config);
  ctx.fillStyle = config.text;
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonboots', padding + 42, logoY + 8);

  // Content area
  const contentArea = {
    x: padding,
    y: logoY + 60,
    width: width - padding * 2,
    height: height - logoY - 120
  };

  // Quote text
  const fontSize = Math.min(width, height) * 0.039;
  ctx.font = `300 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const lines = wrapText(ctx, content, contentArea.width);
  const totalHeight = lines.length * fontSize * 1.4;
  let y = contentArea.y + (contentArea.height - totalHeight) / 2 + fontSize;
  ctx.fillStyle = config.text;
  for (let line of lines) {
    ctx.fillText(line, contentArea.x, y);
    y += fontSize * 1.4;
  }

  // Footer
  ctx.fillStyle = config.accent;
  ctx.font = '400 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a stat highlight image
 */
export function generateStatImage({ stat, context, platform = 'instagram', style = 'vibrant' }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const { width, height } = platformDimensions[platform] || platformDimensions.instagram;
  const config = styleConfigs[style] || styleConfigs.vibrant;

  canvas.width = width;
  canvas.height = height;

  // Background
  if (config.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, config.gradient[0]);
    gradient.addColorStop(1, config.gradient[1]);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = config.bg;
  }
  ctx.fillRect(0, 0, width, height);

  const padding = Math.min(width, height) * 0.055;
  const logoY = padding + 30;

  // Draw logo
  drawMoonLogo(ctx, padding + 14, logoY, config);
  ctx.fillStyle = config.text;
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonboots', padding + 42, logoY + 8);

  // Stat
  const statFontSize = Math.min(width, height) * 0.15;
  const contextFontSize = Math.min(width, height) * 0.032;
  ctx.font = `800 ${statFontSize}px system-ui`;
  ctx.fillStyle = config.text;
  const statY = height / 2;
  ctx.fillText(stat, padding, statY);

  if (context) {
    ctx.font = `300 ${contextFontSize}px system-ui`;
    ctx.fillStyle = config.accent;
    const contextLines = wrapText(ctx, context, width - padding * 2);
    let y = statY + 30;
    contextLines.forEach(line => {
      ctx.fillText(line, padding, y);
      y += contextFontSize * 1.4;
    });
  }

  // Footer
  ctx.fillStyle = config.accent;
  ctx.font = '400 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a question hook image
 */
export function generateQuestionImage({ question, platform = 'instagram', style = 'gradient' }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const { width, height } = platformDimensions[platform] || platformDimensions.instagram;
  const config = styleConfigs[style] || styleConfigs.gradient;

  canvas.width = width;
  canvas.height = height;

  // Background
  if (config.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, config.gradient[0]);
    gradient.addColorStop(1, config.gradient[1]);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = config.bg;
  }
  ctx.fillRect(0, 0, width, height);

  const padding = Math.min(width, height) * 0.055;
  const logoY = padding + 30;

  // Draw logo
  drawMoonLogo(ctx, padding + 14, logoY, config);
  ctx.fillStyle = config.text;
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonboots', padding + 42, logoY + 8);

  const contentArea = {
    x: padding,
    y: logoY + 60,
    width: width - padding * 2,
    height: height - logoY - 120
  };

  // Question text
  const fontSize = Math.min(width, height) * 0.045;
  ctx.font = `600 ${fontSize}px system-ui`;
  const lines = wrapText(ctx, question, contentArea.width);
  const totalHeight = lines.length * fontSize * 1.3;
  let y = contentArea.y + (contentArea.height - totalHeight) / 2 + fontSize;
  ctx.fillStyle = config.text;
  lines.forEach(line => {
    ctx.fillText(line, contentArea.x, y);
    y += fontSize * 1.3;
  });

  // Question mark accent
  ctx.fillStyle = config.accent;
  ctx.globalAlpha = 0.15;
  ctx.font = `900 ${height * 0.6}px system-ui`;
  ctx.fillText('?', width - height * 0.35, height * 0.7);
  ctx.globalAlpha = 1;

  // Footer
  ctx.fillStyle = config.accent;
  ctx.font = '400 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

  return canvas.toDataURL('image/png');
}

/**
 * Extract key content from a post for image generation
 * Returns the most impactful part of the content
 */
function extractKeyContent(content) {
  // Split into sentences/lines
  const lines = content.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 0);

  // Find the hook/headline (usually first meaningful line)
  let headline = lines[0] || content.substring(0, 80);

  // If headline is too long, try to find a shorter impactful line
  if (headline.length > 80) {
    // Look for a shorter punchy line
    const shortLine = lines.find(l => l.length >= 20 && l.length <= 80);
    if (shortLine) headline = shortLine;
    else headline = headline.substring(0, 77) + '...';
  }

  return headline;
}

/**
 * Extract stat and brief context from content
 */
function extractStatContent(content, statMatch) {
  const stat = statMatch[0];
  const lines = content.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 0);

  // Find the line containing the stat
  const statLine = lines.find(l => l.includes(stat)) || '';

  // Get context - the sentence with the stat, cleaned up
  let context = statLine.replace(stat, '').replace(/^[•\-\s]+/, '').trim();

  // If context is too long or empty, try to get a better one
  if (context.length > 100) {
    context = context.substring(0, 97) + '...';
  } else if (context.length < 10) {
    // Use headline as context instead
    context = extractKeyContent(content.replace(statLine, ''));
  }

  return { stat, context };
}

/**
 * Auto-generate an appropriate image based on content
 * Analyzes the text to determine the best template
 */
export function autoGenerateImage({ content, platform = 'instagram', style = 'gradient', template = 'auto' }) {
  // If specific template requested, use it
  if (template && template !== 'auto') {
    switch (template) {
      case 'quote':
        return generateQuoteImage({
          content: extractKeyContent(content),
          platform,
          style
        });
      case 'stat': {
        const statMatch = content.match(/(\d+%|\d+x|\$\d+[KMB]?|\d+ out of \d+|\d+K|\d+M)/i);
        if (statMatch) {
          const { stat, context } = extractStatContent(content, statMatch);
          return generateStatImage({ stat, context, platform, style: 'vibrant' });
        }
        // Fallback if no stat found
        return generateQuoteImage({ content: extractKeyContent(content), platform, style });
      }
      case 'question':
        return generateQuestionImage({
          question: extractKeyContent(content),
          platform,
          style
        });
      default:
        break;
    }
  }

  // Auto-detect best template
  // Detect if content starts with or contains a question
  const firstLine = content.split(/[.\n]/)[0].trim();
  const isQuestion = firstLine.endsWith('?') ||
                     firstLine.toLowerCase().startsWith('what ') ||
                     firstLine.toLowerCase().startsWith('why ') ||
                     firstLine.toLowerCase().startsWith('how ') ||
                     firstLine.toLowerCase().startsWith('when ') ||
                     firstLine.toLowerCase().startsWith('who ');

  // Detect if content has a stat/number
  const statMatch = content.match(/(\d+%|\d+x|\$\d+[KMB]?|\d+ out of \d+|\d+K|\d+M)/i);

  if (statMatch) {
    const { stat, context } = extractStatContent(content, statMatch);
    return generateStatImage({ stat, context, platform, style: 'vibrant' });
  }

  if (isQuestion) {
    return generateQuestionImage({
      question: extractKeyContent(content),
      platform,
      style
    });
  }

  // Default to quote card with just the headline
  return generateQuoteImage({
    content: extractKeyContent(content),
    platform,
    style
  });
}

/**
 * Convert data URL to Blob for upload
 */
export function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export { platformDimensions, styleConfigs };
