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
 * Generate a quote card image with headline and supporting text
 * @param {Object} options
 * @param {string} options.content - The quote/text content (can include headline + body)
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

  const padding = Math.min(width, height) * 0.07;
  const logoY = padding + 30;

  // Draw logo
  drawMoonLogo(ctx, padding + 14, logoY, config, 16);
  ctx.fillStyle = config.text;
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonboots', padding + 46, logoY + 10);

  // Parse content into headline and body
  const parts = content.split('\n\n');
  const headline = parts[0] || content;
  const body = parts.slice(1).join('\n\n');

  // Content area
  const contentArea = {
    x: padding,
    y: logoY + 80,
    width: width - padding * 2,
    height: height - logoY - 160
  };

  // Headline - larger, bolder
  const headlineFontSize = Math.min(width, height) * 0.055;
  ctx.font = `700 ${headlineFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = config.text;
  const headlineLines = wrapText(ctx, headline, contentArea.width);
  const maxHeadlineLines = 3;
  const displayHeadlineLines = headlineLines.slice(0, maxHeadlineLines);

  let y = contentArea.y + headlineFontSize;
  for (let line of displayHeadlineLines) {
    ctx.fillText(line, contentArea.x, y);
    y += headlineFontSize * 1.25;
  }

  // Body text - smaller, lighter weight
  if (body) {
    y += headlineFontSize * 0.5; // Gap between headline and body
    const bodyFontSize = Math.min(width, height) * 0.035;
    ctx.font = `400 ${bodyFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = config.accent;
    const bodyLines = wrapText(ctx, body, contentArea.width);
    const maxBodyLines = 6;
    const displayBodyLines = bodyLines.slice(0, maxBodyLines);

    for (let line of displayBodyLines) {
      if (y > height - padding - 60) break; // Don't overflow into footer
      ctx.fillText(line, contentArea.x, y);
      y += bodyFontSize * 1.4;
    }
  }

  // Footer
  ctx.fillStyle = config.accent;
  ctx.font = '400 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a stat highlight image with large stat and supporting context
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

  const padding = Math.min(width, height) * 0.07;
  const logoY = padding + 30;

  // Draw logo
  drawMoonLogo(ctx, padding + 14, logoY, config, 16);
  ctx.fillStyle = config.text;
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonboots', padding + 46, logoY + 10);

  // Large stat number
  const statFontSize = Math.min(width, height) * 0.18;
  ctx.font = `900 ${statFontSize}px system-ui`;
  ctx.fillStyle = config.text;
  const statY = height * 0.42;
  ctx.fillText(stat, padding, statY);

  // Context text - larger and more visible
  if (context) {
    const contextFontSize = Math.min(width, height) * 0.04;
    ctx.font = `500 ${contextFontSize}px system-ui`;
    ctx.fillStyle = config.text;
    ctx.globalAlpha = 0.9;
    const contextLines = wrapText(ctx, context, width - padding * 2);
    const maxContextLines = 5;
    let y = statY + statFontSize * 0.3;
    contextLines.slice(0, maxContextLines).forEach(line => {
      if (y > height - padding - 60) return;
      ctx.fillText(line, padding, y);
      y += contextFontSize * 1.35;
    });
    ctx.globalAlpha = 1;
  }

  // Footer
  ctx.fillStyle = config.accent;
  ctx.font = '400 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a question hook image with the question and supporting context
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

  const padding = Math.min(width, height) * 0.07;
  const logoY = padding + 30;

  // Draw logo
  drawMoonLogo(ctx, padding + 14, logoY, config, 16);
  ctx.fillStyle = config.text;
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonboots', padding + 46, logoY + 10);

  // Parse question and body (if present)
  const parts = question.split('\n\n');
  const mainQuestion = parts[0] || question;
  const body = parts.slice(1).join('\n\n');

  const contentArea = {
    x: padding,
    y: logoY + 80,
    width: width - padding * 2,
    height: height - logoY - 160
  };

  // Question text - larger, bolder
  const questionFontSize = Math.min(width, height) * 0.055;
  ctx.font = `700 ${questionFontSize}px system-ui`;
  ctx.fillStyle = config.text;
  const questionLines = wrapText(ctx, mainQuestion, contentArea.width);
  const maxQuestionLines = 4;

  let y = contentArea.y + questionFontSize;
  questionLines.slice(0, maxQuestionLines).forEach(line => {
    ctx.fillText(line, contentArea.x, y);
    y += questionFontSize * 1.25;
  });

  // Body text if present
  if (body) {
    y += questionFontSize * 0.5;
    const bodyFontSize = Math.min(width, height) * 0.035;
    ctx.font = `400 ${bodyFontSize}px system-ui`;
    ctx.fillStyle = config.accent;
    const bodyLines = wrapText(ctx, body, contentArea.width);
    bodyLines.slice(0, 5).forEach(line => {
      if (y > height - padding - 60) return;
      ctx.fillText(line, contentArea.x, y);
      y += bodyFontSize * 1.4;
    });
  }

  // Question mark accent (subtle background)
  ctx.fillStyle = config.accent;
  ctx.globalAlpha = 0.1;
  ctx.font = `900 ${height * 0.5}px system-ui`;
  ctx.fillText('?', width - height * 0.3, height * 0.65);
  ctx.globalAlpha = 1;

  // Footer
  ctx.fillStyle = config.accent;
  ctx.font = '400 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

  return canvas.toDataURL('image/png');
}

/**
 * Extract key content from a post for image generation
 * Returns headline and supporting body text
 */
function extractKeyContent(content, options = {}) {
  const { maxHeadlineLength = 120, includeBody = true } = options;

  // Split by double newlines first (paragraphs), then by sentences
  const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);

  // Get headline from first paragraph
  let headline = paragraphs[0] || content;

  // If headline contains a sentence break, take just the first sentence
  const firstSentence = headline.split(/[.!?]\s/)[0];
  if (firstSentence.length >= 30 && firstSentence.length <= maxHeadlineLength) {
    headline = firstSentence;
  } else if (headline.length > maxHeadlineLength) {
    headline = headline.substring(0, maxHeadlineLength - 3) + '...';
  }

  if (!includeBody) {
    return headline;
  }

  // Get body from remaining paragraphs or remaining content
  let body = '';
  if (paragraphs.length > 1) {
    // Use second paragraph as body
    body = paragraphs[1];
    // Add third paragraph if short enough
    if (paragraphs[2] && body.length + paragraphs[2].length < 300) {
      body += '\n\n' + paragraphs[2];
    }
  } else if (headline !== content) {
    // Get remaining content after headline
    const remaining = content.substring(headline.length).trim();
    if (remaining.length > 10) {
      body = remaining.substring(0, 250);
    }
  }

  // Clean up body - remove hashtags and excessive punctuation
  body = body.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();

  return headline + (body ? '\n\n' + body : '');
}

/**
 * Extract stat and meaningful context from content
 */
function extractStatContent(content, statMatch) {
  const stat = statMatch[0];
  const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  const lines = content.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 0);

  // Find the line containing the stat
  const statLine = lines.find(l => l.includes(stat)) || '';

  // Build context: stat line description + supporting content
  let context = statLine.replace(stat, '').replace(/^[•\-\s:]+/, '').trim();

  // Add more context from other paragraphs
  if (paragraphs.length > 1) {
    // Find paragraph that doesn't contain the stat for additional context
    const additionalContext = paragraphs.find(p => !p.includes(stat) && p.length > 20);
    if (additionalContext && context.length + additionalContext.length < 280) {
      context = context + (context ? '\n\n' : '') + additionalContext;
    }
  }

  // If still short, add the headline
  if (context.length < 30) {
    const headline = paragraphs[0] || lines[0] || '';
    if (!headline.includes(stat)) {
      context = headline + (context ? '\n\n' + context : '');
    }
  }

  // Clean up and limit
  context = context.replace(/#\w+/g, '').trim();
  if (context.length > 300) {
    context = context.substring(0, 297) + '...';
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
