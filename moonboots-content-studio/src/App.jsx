import React, { useState, useMemo, useEffect } from 'react';

// Historical performance data with timing
const historicalPerformance = [
  { id: 1, content: "AI isn't replacing strategists—it's amplifying the good ones.", platform: 'linkedin', likes: 142, comments: 23, shares: 12, leads: 2, rating: 5, postedAt: '2025-01-08 09:15', dayOfWeek: 'Wednesday', hour: 9, pillar: 'AI Strategy', length: 58 },
  { id: 2, content: "The future of fan engagement isn't about more content.", platform: 'linkedin', likes: 89, comments: 15, shares: 8, leads: 1, rating: 4, postedAt: '2025-01-07 14:30', dayOfWeek: 'Tuesday', hour: 14, pillar: 'Community Building', length: 78 },
  { id: 3, content: "Stop calling it Web3. Start calling it what it is: infrastructure for trust.", platform: 'x', likes: 234, comments: 45, shares: 67, leads: 0, rating: 5, postedAt: '2025-01-06 11:00', dayOfWeek: 'Monday', hour: 11, pillar: 'Web3', length: 71 },
  { id: 4, content: "Every founder I meet wants to 'implement AI'. Very few can tell me why.", platform: 'linkedin', likes: 198, comments: 34, shares: 22, leads: 3, rating: 5, postedAt: '2025-01-09 08:45', dayOfWeek: 'Thursday', hour: 8, pillar: 'AI Strategy', length: 65 },
  { id: 5, content: "The best technology decisions weren't about technology at all.", platform: 'linkedin', likes: 156, comments: 28, shares: 15, leads: 2, rating: 5, postedAt: '2025-01-10 09:00', dayOfWeek: 'Friday', hour: 9, pillar: 'Business Transformation', length: 72 },
  { id: 6, content: "Community isn't a feature. It's the product.", platform: 'x', likes: 312, comments: 56, shares: 89, leads: 1, rating: 5, postedAt: '2025-01-08 16:30', dayOfWeek: 'Wednesday', hour: 16, pillar: 'Community Building', length: 42 },
  { id: 7, content: "Spent the morning coaching U12s football. Best strategy session of my week.", platform: 'x', likes: 187, comments: 34, shares: 23, leads: 0, rating: 4, postedAt: '2025-01-11 10:15', dayOfWeek: 'Saturday', hour: 10, pillar: 'Sport & Culture', length: 68 },
  { id: 8, content: "Three questions I ask every founder before we talk about AI...", platform: 'linkedin', likes: 267, comments: 45, shares: 34, leads: 4, rating: 5, postedAt: '2025-01-02 09:00', dayOfWeek: 'Thursday', hour: 9, pillar: 'AI Strategy', length: 156 },
  { id: 9, content: "Hot take: Most 'AI transformations' are just expensive spreadsheet upgrades.", platform: 'x', likes: 445, comments: 78, shares: 112, leads: 2, rating: 5, postedAt: '2025-01-03 12:00', dayOfWeek: 'Friday', hour: 12, pillar: 'AI Strategy', length: 72 },
  { id: 10, content: "Building Moments taught me something: creators don't want more tools.", platform: 'instagram', likes: 134, comments: 23, shares: 0, leads: 1, rating: 4, postedAt: '2025-01-05 18:00', dayOfWeek: 'Sunday', hour: 18, pillar: 'Community Building', length: 89 },
  { id: 11, content: "The gap between 'AI curious' and 'AI ready' isn't technical. It's cultural.", platform: 'linkedin', likes: 178, comments: 31, shares: 19, leads: 2, rating: 4, postedAt: '2025-01-06 10:30', dayOfWeek: 'Monday', hour: 10, pillar: 'Business Transformation', length: 76 },
  { id: 12, content: "Decentralisation isn't about removing control. It's about distributing trust.", platform: 'x', likes: 267, comments: 41, shares: 54, leads: 0, rating: 4, postedAt: '2025-01-04 15:00', dayOfWeek: 'Saturday', hour: 15, pillar: 'Web3', length: 68 },
];

const pillars = [
  { id: 'ai', name: 'AI Strategy', color: 'bg-blue-500' },
  { id: 'web3', name: 'Web3', color: 'bg-purple-500' },
  { id: 'community', name: 'Community Building', color: 'bg-green-500' },
  { id: 'transformation', name: 'Business Transformation', color: 'bg-orange-500' },
  { id: 'sport', name: 'Sport & Culture', color: 'bg-pink-500' },
];

const industryBenchmarks = {
  linkedin: { frequency: { min: 3, max: 5, unit: 'week' }, bestDays: ['Tuesday', 'Wednesday', 'Thursday'], bestHours: [8, 9, 10, 12] },
  facebook: { frequency: { min: 3, max: 7, unit: 'week' }, bestDays: ['Wednesday', 'Thursday', 'Friday'], bestHours: [9, 11, 13, 15] },
  x: { frequency: { min: 7, max: 21, unit: 'week' }, bestDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], bestHours: [9, 12, 15, 17] },
  instagram: { frequency: { min: 3, max: 5, unit: 'week' }, bestDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'], bestHours: [11, 13, 18, 20] },
};

const Logo = () => (
  <div className="flex flex-col items-start">
    <img src="/moonboots-logo.png" alt="moonboots" className="h-6" />
    <span className="text-[10px] font-light text-slate-400 tracking-widest -mt-0.5">content studio</span>
  </div>
);

const PlatformIcon = ({ platform, className = "w-5 h-5" }) => {
  const icons = {
    linkedin: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    facebook: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    x: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    instagram: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  };
  return icons[platform] || null;
};

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    publishing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    published: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <span className={`px-2 py-1 text-xs rounded-full border ${styles[status] || styles.pending}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
};

const TabButton = ({ active, onClick, children, count }) => (
  <button onClick={onClick} className={`px-4 py-2 text-sm font-medium transition-all ${active ? 'text-white border-b-2 border-white' : 'text-slate-400 hover:text-slate-200'}`}>
    {children}
    {count !== undefined && <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${active ? 'bg-white text-slate-900' : 'bg-slate-700 text-slate-300'}`}>{count}</span>}
  </button>
);

// Generate template-based image using canvas
const generateTemplateImage = async (content, template, platform, theme = 'midnight') => {
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
const wrapText = (ctx, text, maxWidth) => {
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

// Generate next available time slots for a platform
const getNextTimeSlots = (platform, count = 5) => {
  const benchmark = industryBenchmarks[platform];
  const slots = [];
  const now = new Date();
  let currentDay = now.getDay(); // 0 = Sunday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Get next 14 days of slots
  for (let d = 0; d < 14 && slots.length < count; d++) {
    const checkDay = (currentDay + d) % 7;
    const dayName = dayNames[checkDay];

    if (benchmark.bestDays.includes(dayName)) {
      benchmark.bestHours.forEach(hour => {
        if (slots.length < count) {
          const slotDate = new Date(now);
          slotDate.setDate(slotDate.getDate() + d);
          slotDate.setHours(hour, 0, 0, 0);

          // Only include future times
          if (slotDate > now) {
            slots.push({
              day: dayName,
              hour,
              date: slotDate,
              label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayName,
              full: `${d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayName} ${hour}:00`
            });
          }
        }
      });
    }
  }
  return slots;
};

// Generate AI image using Claude + Replicate (Flux Schnell)
const generateAIImage = async (content, platform, claudeApiKey, replicateApiKey) => {
  // Step 1: Generate optimized image prompt using Claude
  let imagePrompt;
  try {
    const promptResponse = await fetch('/api/generate-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: claudeApiKey,
        postContent: content,
        platform,
        style: 'modern professional, dark moody backgrounds'
      }),
    });

    const promptData = await promptResponse.json();
    if (!promptResponse.ok) {
      throw new Error(promptData.error || 'Failed to generate image prompt');
    }
    imagePrompt = promptData.imagePrompt;
  } catch (error) {
    // Fallback to basic prompt if Claude fails
    console.warn('Claude prompt generation failed, using fallback:', error);
    const firstLine = content.split('\n')[0].trim().substring(0, 100);
    imagePrompt = `Abstract minimalist professional artwork. Dark moody background with subtle gradients. Visual mood: ${firstLine}. No text, no words, no typography. Clean modern design.`;
  }

  // Step 2: Generate image using Replicate (Flux Schnell)
  const aspectRatio = platform === 'instagram' ? 'portrait' : 'landscape';

  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      replicateApiKey,
      prompt: imagePrompt,
      aspectRatio,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate image');
  }

  return data.image || data.imageUrl;
};

// Template themes with colors
const templateThemes = {
  midnight: { name: 'Midnight', gradient: ['#0f172a', '#1e3a5f'], accent: '#3b82f6' },
  forest: { name: 'Forest', gradient: ['#064e3b', '#065f46'], accent: '#10b981' },
  sunset: { name: 'Sunset', gradient: ['#7c2d12', '#9a3412'], accent: '#f97316' },
  purple: { name: 'Purple', gradient: ['#3b0764', '#581c87'], accent: '#a855f7' },
  ocean: { name: 'Ocean', gradient: ['#0c4a6e', '#075985'], accent: '#0ea5e9' },
  charcoal: { name: 'Charcoal', gradient: ['#171717', '#262626'], accent: '#737373' },
};

// Content Generator with optimal timing and images
const ContentGenerator = ({ onGenerate, insights, settings, generatorState, setGeneratorState, workspace }) => {
  // Use workspace pillars if available, otherwise global defaults
  const activePillars = (workspace?.pillars?.length ? workspace.pillars : pillars);
  // Use lifted state from parent
  const {
    topic = '',
    selectedPillar = 'ai',
    platforms = { linkedin: true, facebook: false, x: true, instagram: false },
    generatedContent = null,
    generatedImages = {},
    generatingImages = {},
    useOptimalTiming = true,
    selectedSlots = {},
    customScheduleTimes = {},
    scheduleMode = 'optimal',
    platformImageSettings = {
      linkedin: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
      facebook: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
      x: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
      instagram: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
    },
    expandedPlatformSettings = null,
  } = generatorState;

  const [generating, setGenerating] = useState(false);
  const [showScheduleOptions, setShowScheduleOptions] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);

  // Helper to update lifted state
  const updateState = (updates) => {
    setGeneratorState(prev => ({ ...prev, ...updates }));
  };

  const setTopic = (value) => updateState({ topic: value });
  const setSelectedPillar = (value) => updateState({ selectedPillar: value });
  const setPlatforms = (value) => updateState({ platforms: typeof value === 'function' ? value(platforms) : value });
  const setGeneratedContent = (value) => updateState({ generatedContent: typeof value === 'function' ? value(generatedContent) : value });
  // Use setGeneratorState directly to access actual prev state (fixes stale closure in parallel async ops)
  const setGeneratedImages = (value) => {
    setGeneratorState(prev => ({
      ...prev,
      generatedImages: typeof value === 'function' ? value(prev.generatedImages || {}) : value
    }));
  };
  const setGeneratingImages = (value) => {
    setGeneratorState(prev => ({
      ...prev,
      generatingImages: typeof value === 'function' ? value(prev.generatingImages || {}) : value
    }));
  };
  const setUseOptimalTiming = (value) => updateState({ useOptimalTiming: value });
  const setSelectedSlots = (value) => updateState({ selectedSlots: typeof value === 'function' ? value(selectedSlots) : value });
  const setCustomScheduleTimes = (value) => updateState({ customScheduleTimes: typeof value === 'function' ? value(customScheduleTimes) : value });
  const setScheduleMode = (value) => updateState({ scheduleMode: value });
  const setPlatformImageSettings = (value) => updateState({ platformImageSettings: typeof value === 'function' ? value(platformImageSettings) : value });
  const setExpandedPlatformSettings = (value) => updateState({ expandedPlatformSettings: value });

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedImages({});
    setGeneratedContent(null);

    let content;

    // Use Claude API if key is configured, otherwise use fallback
    if (settings.claudeApiKey) {
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: settings.claudeApiKey,
            topic,
            pillar: activePillars.find(p => p.id === selectedPillar)?.name,
            platforms,
            workspaceId: workspace?.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate content');
        }

        content = data.content;
      } catch (error) {
        console.error('Content generation failed:', error);
        alert(`Failed to generate content: ${error.message}. Using fallback templates.`);
        // Fallback to templates
        content = {
          linkedin: `${topic}\n\nThis isn't about chasing trends—it's about building systems that last.\n\nThree things I've learned:\n\n1. Start with the problem, not the technology\n2. Simple beats sophisticated every time\n3. Your users will tell you what they need—if you listen\n\nThe organisations getting this right aren't the loudest. They're the most curious.`,
          x: `${topic}\n\nMost get this wrong.\n\nThey start with tools. They should start with problems.\n\nClarity > complexity. Every time.`,
          instagram: `${topic}\n\nAfter years of working with founders on this, one thing is clear:\n\nThe best technology serves people—not the other way around.\n\n#Strategy #AI #Innovation #Leadership`,
        };
      }
    } else {
      // No API key - use fallback templates
      content = {
        linkedin: `${topic}\n\nThis isn't about chasing trends—it's about building systems that last.\n\nThree things I've learned:\n\n1. Start with the problem, not the technology\n2. Simple beats sophisticated every time\n3. Your users will tell you what they need—if you listen\n\nThe organisations getting this right aren't the loudest. They're the most curious.`,
        x: `${topic}\n\nMost get this wrong.\n\nThey start with tools. They should start with problems.\n\nClarity > complexity. Every time.`,
        instagram: `${topic}\n\nAfter years of working with founders on this, one thing is clear:\n\nThe best technology serves people—not the other way around.\n\n#Strategy #AI #Innovation #Leadership`,
      };
    }

    setGeneratedContent(content);

    // Auto-generate images for each platform based on per-platform settings
    const enabledPlatforms = Object.keys(platforms).filter(p => platforms[p] && content[p] && platformImageSettings[p]?.enabled);

    // Set all as generating
    enabledPlatforms.forEach(platform => {
      setGeneratingImages(prev => ({ ...prev, [platform]: true }));
    });

    // Generate all images in parallel
    await Promise.all(enabledPlatforms.map(async (platform) => {
      const imgSettings = platformImageSettings[platform] || { enabled: true, type: 'template', template: 'quote', theme: 'midnight' };

      try {
        let imageUrl;
        if (imgSettings.type === 'ai') {
          if (!settings.replicateApiKey) {
            console.warn(`No Replicate API key configured, using template for ${platform}`);
            alert(`Replicate API key not configured. Using template for ${platform} image.`);
            imageUrl = await generateTemplateImage(content[platform], imgSettings.template, platform, imgSettings.theme);
          } else {
            // AI image generation using Claude + Replicate
            try {
              imageUrl = await generateAIImage(content[platform], platform, settings.claudeApiKey, settings.replicateApiKey);
            } catch (error) {
              console.error(`AI image generation failed for ${platform}:`, error);
              alert(`AI image generation failed for ${platform}: ${error.message}. Using template instead.`);
              // Fall back to template on error
              imageUrl = await generateTemplateImage(content[platform], imgSettings.template, platform, imgSettings.theme);
            }
          }
        } else {
          // Template-based image generation
          imageUrl = await generateTemplateImage(content[platform], imgSettings.template, platform, imgSettings.theme);
        }

        if (imageUrl) {
          setGeneratedImages(prev => ({ ...prev, [platform]: imageUrl }));
        }
      } catch (error) {
        console.error(`Image generation failed for ${platform}:`, error);
      } finally {
        setGeneratingImages(prev => ({ ...prev, [platform]: false }));
      }
    }));

    setGenerating(false);
  };

  const handleRegenerateImage = async (platform, content) => {
    const imgSettings = platformImageSettings[platform] || { enabled: true, type: 'template', template: 'quote', theme: 'midnight' };
    setGeneratingImages(prev => ({ ...prev, [platform]: true }));

    if (imgSettings.type === 'ai' && settings.replicateApiKey) {
      try {
        const imageUrl = await generateAIImage(content, platform, settings.claudeApiKey, settings.replicateApiKey);
        setGeneratedImages(prev => ({ ...prev, [platform]: imageUrl }));
      } catch (error) {
        console.error(`AI image regeneration failed for ${platform}:`, error);
        // Fall back to template on error
        const imageUrl = await generateTemplateImage(content, imgSettings.template, platform, imgSettings.theme);
        setGeneratedImages(prev => ({ ...prev, [platform]: imageUrl }));
      }
    } else {
      try {
        const imageUrl = await generateTemplateImage(content, imgSettings.template, platform, imgSettings.theme);
        setGeneratedImages(prev => ({ ...prev, [platform]: imageUrl }));
      } catch (error) {
        console.error(`Template image regeneration failed for ${platform}:`, error);
      }
    }
    setGeneratingImages(prev => ({ ...prev, [platform]: false }));
  };

  const updatePlatformImageSetting = (platform, key, value) => {
    setPlatformImageSettings(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [key]: value }
    }));
  };

  const handleAddToQueue = (platform) => {
    if (generatedContent?.[platform]) {
      // Use selected slot, or first available slot if auto-schedule is on
      let scheduledTime = null;
      let scheduledISO = null;
      if (scheduleMode === 'custom' && customScheduleTimes[platform]) {
        const dt = new Date(customScheduleTimes[platform]);
        scheduledTime = dt.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        scheduledISO = dt.toISOString();
      } else if (scheduleMode === 'optimal' && useOptimalTiming) {
        const slot = selectedSlots[platform] || getNextTimeSlots(platform, 1)[0];
        scheduledTime = slot ? slot.full : null;
        scheduledISO = slot ? slot.date.toISOString() : null;
      }
      onGenerate({
        content: generatedContent[platform],
        platform,
        pillar: activePillars.find(p => p.id === selectedPillar)?.name,
        suggestedTime: scheduledTime,
        scheduledFor: scheduledISO,
        image: generatedImages[platform] || null,
      });
      setGeneratedContent(prev => ({ ...prev, [platform]: null }));
      setGeneratedImages(prev => ({ ...prev, [platform]: null }));
      setSelectedSlots(prev => ({ ...prev, [platform]: null }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Scheduling Panel */}
      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">Scheduling</h4>
          <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-0.5">
            {[
              { id: 'now', label: 'Post Now' },
              { id: 'optimal', label: 'Optimal' },
              { id: 'custom', label: 'Custom' },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setScheduleMode(mode.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  scheduleMode === mode.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {scheduleMode === 'now' && (
          <p className="text-xs text-slate-400">Posts will be added to the queue without a scheduled time. Publish manually when ready.</p>
        )}

        {scheduleMode === 'optimal' && (
          <div className="space-y-3">
            {['linkedin', 'facebook', 'x', 'instagram'].filter(p => platforms[p]).map(platform => {
              const slots = getNextTimeSlots(platform, 5);
              const selected = selectedSlots[platform] || slots[0];
              const benchmark = industryBenchmarks[platform];
              return (
                <div key={platform} className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-white capitalize">{platform === 'x' ? 'X' : platform}</span>
                      <span className="text-xs text-slate-500">({benchmark.frequency.min}-{benchmark.frequency.max}x/week)</span>
                    </div>
                    <span className="text-xs text-blue-400">{selected?.full || 'No slot'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {slots.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedSlots(prev => ({ ...prev, [platform]: slot }))}
                        className={`px-2 py-1 text-xs rounded ${
                          selected?.full === slot.full
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {slot.label} {slot.hour}:00
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Best days: {benchmark.bestDays.join(', ')}</p>
                </div>
              );
            })}
          </div>
        )}

        {scheduleMode === 'custom' && (
          <div className="space-y-3">
            {['linkedin', 'facebook', 'x', 'instagram'].filter(p => platforms[p]).map(platform => {
              const minDate = new Date();
              minDate.setMinutes(minDate.getMinutes() + 5);
              const minDateStr = minDate.toISOString().slice(0, 16);
              return (
                <div key={platform} className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-white capitalize">{platform === 'x' ? 'X' : platform}</span>
                    </div>
                    <input
                      type="datetime-local"
                      min={minDateStr}
                      value={customScheduleTimes[platform] || ''}
                      onChange={(e) => setCustomScheduleTimes(prev => ({ ...prev, [platform]: e.target.value }))}
                      className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {customScheduleTimes[platform] && (
                    <p className="text-[10px] text-blue-400 mt-1">
                      Scheduled: {new Date(customScheduleTimes[platform]).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">Topic or idea</label>
          <button
            onClick={async () => {
              if (!settings.claudeApiKey) {
                alert('Please add your Claude API key in Settings to use topic suggestions');
                return;
              }
              setGenerating(true);
              try {
                const response = await fetch('/api/suggest-topic', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    apiKey: settings.claudeApiKey,
                    pillar: activePillars.find(p => p.id === selectedPillar)?.name,
                  }),
                });
                const data = await response.json();
                if (data.success && data.topic) {
                  setTopic(data.topic);
                } else {
                  alert(data.error || 'Failed to suggest topic');
                }
              } catch (error) {
                console.error('Topic suggestion failed:', error);
                alert('Failed to suggest topic');
              }
              setGenerating(false);
            }}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            {generating ? 'Thinking...' : 'Suggest Topic'}
          </button>
        </div>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Why most AI strategies fail in the first year..." className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none" rows={3} />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Content pillar</label>
        <div className="flex flex-wrap gap-2">
          {activePillars.map(pillar => (
            <button key={pillar.id} onClick={() => setSelectedPillar(pillar.id)} className={`px-3 py-1.5 text-sm rounded-full border transition-all ${selectedPillar === pillar.id ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:border-slate-500'}`}>
              {pillar.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Generate for</label>
        <div className="space-y-3">
          {['linkedin', 'facebook', 'x', 'instagram'].map(platform => {
            const imgSettings = platformImageSettings[platform] || { enabled: true, type: 'template', template: 'quote', theme: 'midnight' };
            const isExpanded = expandedPlatformSettings === platform;
            return (
              <div key={platform} className="bg-slate-800/30 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={platforms[platform]} onChange={(e) => setPlatforms(prev => ({ ...prev, [platform]: e.target.checked }))} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-white focus:ring-0" />
                    <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300 capitalize">{platform === 'x' ? 'X' : platform}</span>
                  </label>
                  {platforms[platform] && (
                    <button
                      onClick={() => setExpandedPlatformSettings(isExpanded ? null : platform)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
                    >
                      <span className="px-2 py-0.5 bg-slate-700/50 rounded">
                        {imgSettings.enabled ? (imgSettings.type === 'ai' ? 'AI Image' : `${imgSettings.theme}`) : 'No image'}
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  )}
                </div>

                {platforms[platform] && isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-slate-700/30 space-y-3">
                    {/* Image enabled toggle */}
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-xs text-slate-400">Include image</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={imgSettings.enabled}
                          onChange={(e) => updatePlatformImageSetting(platform, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>

                    {imgSettings.enabled && (
                      <>
                        {/* Image type: Template vs AI */}
                        <div>
                          <span className="text-xs text-slate-400 block mb-2">Image type</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePlatformImageSetting(platform, 'type', 'template')}
                              className={`flex-1 px-3 py-2 text-xs rounded-lg border ${imgSettings.type === 'template' ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/50 text-slate-300 border-slate-700'}`}
                            >
                              Template
                            </button>
                            <button
                              onClick={() => updatePlatformImageSetting(platform, 'type', 'ai')}
                              className={`flex-1 px-3 py-2 text-xs rounded-lg border ${imgSettings.type === 'ai' ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/50 text-slate-300 border-slate-700'}`}
                            >
                              AI Generated
                            </button>
                          </div>
                          {imgSettings.type === 'ai' && !settings.replicateApiKey && (
                            <p className="text-xs text-yellow-400 mt-1">Replicate API key required for AI images</p>
                          )}
                        </div>

                        {/* Template settings (shown when template type selected) */}
                        {imgSettings.type === 'template' && (
                          <>
                            {/* Template layout */}
                            <div>
                              <span className="text-xs text-slate-400 block mb-2">Layout</span>
                              <div className="flex flex-wrap gap-1">
                                {['quote', 'stat', 'question', 'insight'].map(t => (
                                  <button
                                    key={t}
                                    onClick={() => updatePlatformImageSetting(platform, 'template', t)}
                                    className={`px-2 py-1 text-xs rounded capitalize ${imgSettings.template === t ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Theme selection */}
                            <div>
                              <span className="text-xs text-slate-400 block mb-2">Theme</span>
                              <div className="grid grid-cols-3 gap-1">
                                {Object.entries(templateThemes).map(([key, theme]) => (
                                  <button
                                    key={key}
                                    onClick={() => updatePlatformImageSetting(platform, 'theme', key)}
                                    className={`px-2 py-1.5 text-xs rounded flex items-center gap-1.5 ${imgSettings.theme === key ? 'ring-2 ring-white' : ''}`}
                                    style={{ background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})` }}
                                  >
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.accent }} />
                                    <span className="text-white">{theme.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={!topic || generating} className="w-full py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {generating ? <><div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />Generating...</> : <>Generate Content</>}
      </button>

      {generatedContent && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-sm font-medium text-slate-300">Generated Content</h3>
          {Object.entries(generatedContent).map(([platform, content]) => {
            if (!content || !platforms[platform]) return null;
            const imgSettings = platformImageSettings[platform] || { enabled: true, type: 'template', template: 'quote', theme: 'midnight' };
            return (
              <div key={platform} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300 capitalize">{platform === 'x' ? 'X (Manual)' : platform}</span>
                    {imgSettings.enabled && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${imgSettings.type === 'ai' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700/50 text-slate-400'}`}>
                        {imgSettings.type === 'ai' ? 'AI Image' : `${templateThemes[imgSettings.theme]?.name || imgSettings.theme}`}
                      </span>
                    )}
                    {useOptimalTiming && selectedSlots[platform] && <span className="text-xs text-blue-400">→ {selectedSlots[platform].full}</span>}
                  </div>
                  <button onClick={() => handleAddToQueue(platform)} className="px-3 py-1 text-xs bg-white text-slate-900 rounded hover:bg-slate-100">Add to Queue</button>
                </div>

                <div className="flex gap-4">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap flex-1">{content}</p>

                  {/* Image preview */}
                  {imgSettings.enabled && (
                    <div className="flex-shrink-0">
                      {generatingImages[platform] ? (
                        <div className="w-32 h-32 bg-slate-700/50 rounded-lg flex flex-col items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                          <span className="text-[10px] text-slate-500">{imgSettings.type === 'ai' ? 'AI generating...' : 'Creating...'}</span>
                        </div>
                      ) : generatedImages[platform] ? (
                        <div className="relative group cursor-pointer" onClick={() => setExpandedImage(generatedImages[platform])}>
                          <img src={generatedImages[platform]} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setExpandedImage(generatedImages[platform]); }} className="p-1.5 bg-white/20 rounded hover:bg-white/30" title="Expand">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleRegenerateImage(platform, content); }} className="p-1.5 bg-white/20 rounded hover:bg-white/30" title="Regenerate">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                            <a href={generatedImages[platform]} download={`${platform}-image.png`} onClick={(e) => e.stopPropagation()} className="p-1.5 bg-white/20 rounded hover:bg-white/30" title="Download">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="w-32 h-32 bg-slate-700/30 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-slate-500">No image</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image expansion modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <img src={expandedImage} alt="Expanded" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-black/70 text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <a
              href={expandedImage}
              download="moonboots-image.png"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-slate-100 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// Insights Dashboard with Learning Engine
const InsightsDashboard = ({ performance }) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = [8, 9, 10, 11, 12, 14, 15, 16, 17, 18];

  const insights = useMemo(() => {
    const platformData = {}, pillarData = {}, hourData = {}, dayData = {};
    const lengthBuckets = { short: [], medium: [], long: [] };

    performance.forEach(post => {
      const engagement = post.likes + post.comments * 2 + post.shares * 3;

      if (!platformData[post.platform]) platformData[post.platform] = { posts: 0, engagement: 0, leads: 0 };
      platformData[post.platform].posts++;
      platformData[post.platform].engagement += engagement;
      platformData[post.platform].leads += post.leads;

      if (!pillarData[post.pillar]) pillarData[post.pillar] = { posts: 0, engagement: 0, leads: 0 };
      pillarData[post.pillar].posts++;
      pillarData[post.pillar].engagement += engagement;
      pillarData[post.pillar].leads += post.leads;

      if (!hourData[post.hour]) hourData[post.hour] = { posts: 0, engagement: 0 };
      hourData[post.hour].posts++;
      hourData[post.hour].engagement += engagement;

      if (!dayData[post.dayOfWeek]) dayData[post.dayOfWeek] = { posts: 0, engagement: 0 };
      dayData[post.dayOfWeek].posts++;
      dayData[post.dayOfWeek].engagement += engagement;

      if (post.length < 70) lengthBuckets.short.push(engagement);
      else if (post.length < 120) lengthBuckets.medium.push(engagement);
      else lengthBuckets.long.push(engagement);
    });

    Object.keys(platformData).forEach(p => { platformData[p].avgEngagement = Math.round(platformData[p].engagement / platformData[p].posts); });
    Object.keys(pillarData).forEach(p => { pillarData[p].avgEngagement = Math.round(pillarData[p].engagement / pillarData[p].posts); });
    Object.keys(hourData).forEach(h => { hourData[h].avgEngagement = Math.round(hourData[h].engagement / hourData[h].posts); });
    Object.keys(dayData).forEach(d => { dayData[d].avgEngagement = Math.round(dayData[d].engagement / dayData[d].posts); });

    const optimal = {};
    ['linkedin', 'x', 'instagram'].forEach(platform => {
      const posts = performance.filter(p => p.platform === platform);
      if (posts.length > 0) {
        const best = posts.reduce((a, b) => (a.likes + a.comments * 2 + a.shares * 3) > (b.likes + b.comments * 2 + b.shares * 3) ? a : b);
        optimal[platform] = { day: best.dayOfWeek, hour: best.hour };
      }
    });

    return { platformData, pillarData, hourData, dayData, optimal };
  }, [performance]);

  const heatmapData = useMemo(() => {
    const data = {};
    let maxValue = 0;
    days.forEach(day => {
      data[day] = {};
      hours.forEach(hour => {
        const posts = performance.filter(p => p.dayOfWeek === day && p.hour === hour);
        const avg = posts.length > 0 ? posts.reduce((acc, p) => acc + p.likes + p.comments * 2 + p.shares * 3, 0) / posts.length : 0;
        data[day][hour] = avg;
        if (avg > maxValue) maxValue = avg;
      });
    });
    return { data, maxValue };
  }, [performance]);

  const recommendations = useMemo(() => {
    const recs = [];
    const sortedPillars = Object.entries(insights.pillarData).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
    if (sortedPillars.length > 1) {
      const diff = Math.round((sortedPillars[0][1].avgEngagement / sortedPillars[sortedPillars.length-1][1].avgEngagement - 1) * 100);
      recs.push({ icon: 'target', text: `"${sortedPillars[0][0]}" content gets ${diff}% more engagement than other pillars` });
    }
    const sortedDays = Object.entries(insights.dayData).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
    if (sortedDays.length > 0) recs.push({ icon: 'clock', text: `${sortedDays[0][0]}s are your best day (${sortedDays[0][1].avgEngagement} avg engagement)` });
    const sortedHours = Object.entries(insights.hourData).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
    if (sortedHours.length > 0) recs.push({ icon: 'time', text: `Posts at ${sortedHours[0][0]}:00 perform best` });
    const leadPillar = Object.entries(insights.pillarData).sort((a, b) => b[1].leads - a[1].leads)[0];
    if (leadPillar?.[1].leads > 0) recs.push({ icon: 'briefcase', text: `"${leadPillar[0]}" generates the most leads (${leadPillar[1].leads} total)` });
    return recs;
  }, [insights]);

  return (
    <div className="space-y-8">
      {/* Platform Performance */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Platform Performance</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(insights.platformData).map(([platform, data]) => (
            <div key={platform} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-2 mb-3">
                <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">{platform}</span>
              </div>
              <p className="text-2xl font-light text-white mb-1">{data.avgEngagement}</p>
              <p className="text-xs text-slate-500">avg engagement</p>
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-xs text-green-400">{data.leads} leads</span>
                <span className="text-xs text-slate-500 ml-2">from {data.posts} posts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timing Heatmap */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Best Times to Post (Your Data)</h3>
        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${hours.length}, 1fr)` }}>
            <div></div>
            {hours.map(h => <div key={h} className="text-xs text-slate-500 text-center">{h}:00</div>)}
            {days.map(day => (
              <React.Fragment key={day}>
                <div className="text-xs text-slate-400 flex items-center">{day.slice(0, 3)}</div>
                {hours.map(hour => {
                  const value = heatmapData.data[day][hour];
                  const intensity = heatmapData.maxValue > 0 ? value / heatmapData.maxValue : 0;
                  const bg = intensity === 0 ? 'bg-slate-800/50' : intensity < 0.33 ? 'bg-blue-900/50' : intensity < 0.66 ? 'bg-blue-700/60' : 'bg-blue-500/70';
                  return <div key={`${day}-${hour}`} className={`aspect-square rounded ${bg} hover:ring-1 hover:ring-blue-400`} title={`${day} ${hour}:00: ${Math.round(value)} engagement`} />;
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center justify-end gap-4 mt-4 text-xs text-slate-500">
            <span>Low</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-slate-800/50" />
              <div className="w-4 h-4 rounded bg-blue-900/50" />
              <div className="w-4 h-4 rounded bg-blue-700/60" />
              <div className="w-4 h-4 rounded bg-blue-500/70" />
            </div>
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Pillar Performance */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Content Pillar Performance</h3>
        <div className="space-y-3">
          {Object.entries(insights.pillarData).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement).map(([pillar, data]) => {
            const maxEng = Math.max(...Object.values(insights.pillarData).map(d => d.avgEngagement));
            return (
              <div key={pillar} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">{pillar}</span>
                  <span className="text-sm text-white">{data.avgEngagement} avg</span>
                </div>
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" style={{ width: `${(data.avgEngagement / maxEng) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>{data.posts} posts</span>
                  <span>{data.leads} leads</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Frequency Recommendations */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Recommended Posting Frequency</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(industryBenchmarks).map(([platform, data]) => (
            <div key={platform} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-2 mb-3">
                <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">{platform}</span>
              </div>
              <p className="text-lg text-white">{data.frequency.min}-{data.frequency.max}x<span className="text-xs text-slate-500 ml-1">/ {data.frequency.unit}</span></p>
              <p className="text-xs text-slate-500 mt-1">Best: {data.bestDays.slice(0, 2).join(', ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Learning Insights */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Learning Insights</h3>
        <div className="p-4 bg-gradient-to-br from-blue-900/30 to-slate-800/50 rounded-xl border border-blue-800/30 space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-slate-400 text-sm">&bull;</span>
              <p className="text-sm text-slate-300">{rec.text}</p>
            </div>
          ))}
          <div className="pt-3 border-t border-slate-700/30 text-xs text-slate-500">
            Based on {performance.length} posts. Insights improve as you post more.
          </div>
        </div>
      </div>

      {/* Your Optimal Schedule */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Your Optimal Schedule</h3>
        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(insights.optimal).map(([platform, data]) => (
              <div key={platform} className="text-center">
                <PlatformIcon platform={platform} className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-white font-medium">{data.day}</p>
                <p className="text-slate-400 text-sm">{data.hour}:00</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Approval Queue with images
const ApprovalQueue = ({ posts, onApprove, onReject, onUnapprove, onRemoveImage, onCopy, onEdit, onDelete }) => {
  const pending = posts.filter(p => p.status === 'pending');
  const approved = posts.filter(p => p.status === 'approved' || p.status === 'publishing' || p.status === 'published');
  const rejected = posts.filter(p => p.status === 'rejected');
  const [expandedImage, setExpandedImage] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');

  const handleStartEdit = (post) => {
    setEditingPost(post);
    setEditContent(post.content);
  };

  const handleSaveEdit = () => {
    if (editingPost && editContent.trim()) {
      onEdit(editingPost.id, editContent);
      setEditingPost(null);
      setEditContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditContent('');
  };

  const PostCard = ({ post, showActions = true, showCopy = false }) => (
    <div className={`p-5 bg-slate-800/50 rounded-xl border ${post.status === 'pending' ? 'border-slate-700/50' : post.status === 'rejected' ? 'border-red-900/30' : 'border-green-900/30'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={post.platform} className="w-5 h-5 text-slate-400" />
          <span className="text-xs px-2 py-1 bg-slate-700/50 rounded-full text-slate-300">{post.pillar}</span>
          {post.platform === 'x' && <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">Manual</span>}
        </div>
        <StatusBadge status={post.status} />
      </div>

      <div className="flex gap-4 mb-4">
        <p className="text-slate-200 text-sm whitespace-pre-wrap flex-1">{post.content}</p>

        {/* Image preview in queue */}
        {post.image && (
          <div className="flex-shrink-0">
            <div
              className="relative cursor-pointer group"
              onClick={() => setExpandedImage(post.image)}
            >
              <img src={post.image} alt="Post image" className="w-24 h-24 object-cover rounded-lg" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <span className="text-xs text-white">Click to expand</span>
              </div>
            </div>
            {showActions && (
              <button
                onClick={() => onRemoveImage(post.id)}
                className="mt-1 text-xs text-slate-500 hover:text-red-400 w-full text-center"
              >
                Remove image
              </button>
            )}
          </div>
        )}
      </div>

      {post.suggestedTime && !post.scheduledFor && <p className="text-xs text-blue-400 mb-2">Suggested: {post.suggestedTime}</p>}
      {post.scheduledFor && <p className="text-xs text-blue-400 mb-2">Scheduled: {post.scheduledFor}</p>}
      {post.approvedAt && <p className="text-xs text-green-400 mb-2">Approved: {new Date(post.approvedAt).toLocaleString()}</p>}
      {post.publishedAt && <p className="text-xs text-green-400 mb-2">Published: {new Date(post.publishedAt).toLocaleString()}</p>}
      {post.error && <p className="text-xs text-red-400 mb-2">Error: {post.error}</p>}

      {showActions && post.status === 'pending' && (
        <div className="flex items-center gap-2">
          <button onClick={() => onApprove(post.id)} className="px-4 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">Approve</button>
          <button onClick={() => handleStartEdit(post)} className="px-4 py-2 text-sm bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">Edit</button>
          <button onClick={() => onReject(post.id)} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Reject</button>
        </div>
      )}

      {showCopy && (post.status === 'approved' || post.status === 'published' || post.status === 'rejected') && (
        <div className="flex items-center gap-2 flex-wrap">
          {post.status === 'approved' && (
            <button onClick={() => onUnapprove(post.id)} className="px-4 py-2 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              Return to Queue
            </button>
          )}
          <button onClick={() => onCopy(post)} className="px-4 py-2 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copy
          </button>
          <button onClick={() => handleStartEdit(post)} className="px-4 py-2 text-sm bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">Edit</button>
          <button onClick={() => onDelete(post.id)} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Delete</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Pending Section */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          Awaiting Approval
          {pending.length > 0 && <span className="text-xs text-slate-500">({pending.length})</span>}
        </h3>
        {pending.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <p className="text-slate-500 text-sm">No posts awaiting approval</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>

      {/* Approved/Published Section */}
      {approved.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Approved & Ready to Publish
            <span className="text-xs text-slate-500">({approved.length})</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">Copy content and paste into Publer to publish</p>
          <div className="space-y-4">
            {approved.map(post => <PostCard key={post.id} post={post} showActions={false} showCopy={true} />)}
          </div>
        </div>
      )}

      {/* Rejected Section */}
      {rejected.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Rejected
            <span className="text-xs text-slate-500">({rejected.length})</span>
          </h3>
          <div className="space-y-4">
            {rejected.map(post => <PostCard key={post.id} post={post} showActions={false} />)}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={handleCancelEdit}>
          <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Edit Post</h3>
              <button onClick={handleCancelEdit} className="text-slate-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <PlatformIcon platform={editingPost.platform} className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">{editingPost.platform}</span>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-64 px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-slate-500 resize-none"
              placeholder="Edit your post content..."
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Image modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img src={expandedImage} alt="Expanded" className="max-w-full max-h-[90vh] rounded-lg" />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-black/70"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Calendar View
const CalendarView = ({ posts }) => {
  const scheduled = posts.filter(p => p.scheduledFor && p.status === 'approved');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 28 }, (_, i) => {
          const day = i + 1;
          const hasPost = scheduled.some(p => parseInt(p.scheduledFor?.split(' ')[0]?.split('-')[2]) === day);
          return <div key={i} className={`aspect-square rounded-lg flex items-center justify-center text-sm ${hasPost ? 'bg-white text-slate-900 font-medium' : 'bg-slate-800/50 text-slate-400'}`}>{day}</div>;
        })}
      </div>
      <div className="pt-4 border-t border-slate-800">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Scheduled</h3>
        {scheduled.length === 0 ? <p className="text-sm text-slate-500">No posts scheduled</p> : scheduled.map(post => (
          <div key={post.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg mb-2">
            <PlatformIcon platform={post.platform} className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-300 truncate flex-1">{post.content.substring(0, 50)}...</p>
            {post.image && <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0"><img src={post.image} alt="" className="w-full h-full object-cover" /></div>}
            <span className="text-xs text-slate-500">{post.scheduledFor}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Quote Card Maker
const QuoteCardMaker = () => {
  const [quote, setQuote] = useState('');
  const [style, setStyle] = useState('dark');
  const styles = { dark: { bg: 'bg-slate-900', text: 'text-white', accent: 'text-slate-400' }, light: { bg: 'bg-white', text: 'text-slate-900', accent: 'text-slate-500' }, gradient: { bg: 'bg-gradient-to-br from-slate-900 to-blue-900', text: 'text-white', accent: 'text-slate-300' } };
  const s = styles[style];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm text-slate-400 mb-2">Quote text</label>
        <textarea value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Enter your quote..." className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none resize-none" rows={3} />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-2">Style</label>
        <div className="flex gap-2">
          {Object.keys(styles).map(st => <button key={st} onClick={() => setStyle(st)} className={`px-4 py-2 text-sm rounded-lg border capitalize ${style === st ? 'bg-white text-slate-900' : 'bg-slate-800/50 text-slate-300 border-slate-700'}`}>{st}</button>)}
        </div>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-2">Preview</label>
        <div className={`aspect-square max-w-md mx-auto ${s.bg} rounded-xl p-8 flex flex-col justify-between`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 relative">
              <div className={`absolute inset-0 rounded-full ${style === 'light' ? 'bg-slate-900' : 'bg-white'}`} />
              <div className={`absolute rounded-full ${style === 'light' ? 'bg-white' : 'bg-slate-900'}`} style={{ width: '70%', height: '70%', top: '15%', left: '35%' }} />
            </div>
            <span className={`text-sm font-medium ${s.text}`}>moonboots</span>
          </div>
          <p className={`text-xl font-light leading-relaxed ${s.text}`}>{quote || "Your quote here..."}</p>
          <div className={`text-sm ${s.accent}`}>moonbootsconsultancy.net</div>
        </div>
      </div>
      <button disabled={!quote} className="w-full py-3 bg-white text-slate-900 font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">Download Image</button>
    </div>
  );
};

// Settings Panel with localStorage persistence (auto-save)
const SettingsPanel = ({ settings, onSettingsChange, workspace }) => {
  const [saveStatus, setSaveStatus] = useState('');
  const [testingPubler, setTestingPubler] = useState(false);
  const [publerStatus, setPublerStatus] = useState(null);

  // Load cached Publer status from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('publerConnectionStatus');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Only use cached status if API key matches
        if (parsed.apiKeyHash === settings.publerApiKey?.slice(-8)) {
          setPublerStatus(parsed.status);
        }
      } catch (e) {
        console.error('Failed to parse cached Publer status:', e);
      }
    }
  }, [settings.publerApiKey]);

  // Auto-test connection on mount if API key exists but no cached status
  useEffect(() => {
    if (settings.publerApiKey && !publerStatus && !testingPubler) {
      const cached = localStorage.getItem('publerConnectionStatus');
      if (!cached) {
        testPublerConnection();
      }
    }
  }, [settings.publerApiKey]);

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 2000);

    // Sync Publer settings to server for workspace (so Marcus/agents can use them)
    if ((key === 'publerApiKey' || key === 'platformAccounts') && workspace?.id) {
      fetch(`/api/workspaces/${workspace.id}/publer-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publerApiKey: key === 'publerApiKey' ? value : settings.publerApiKey,
          platformAccounts: key === 'platformAccounts' ? value : settings.platformAccounts,
        }),
      }).catch(() => {}); // Fire and forget
    }
  };

  const testPublerConnection = async () => {
    if (!settings.publerApiKey) {
      setPublerStatus({ success: false, message: 'Please enter a Publer API key first' });
      return;
    }
    setTestingPubler(true);
    setPublerStatus(null);
    try {
      const response = await fetch('/api/publer/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.publerApiKey }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const newStatus = {
          success: true,
          message: `Connected! Found ${data.accountCount} account(s): ${data.accounts}`,
          accountsList: data.accountsList || []
        };
        setPublerStatus(newStatus);
        // Cache the status to localStorage with last 8 chars of API key as hash
        localStorage.setItem('publerConnectionStatus', JSON.stringify({
          apiKeyHash: settings.publerApiKey.slice(-8),
          status: newStatus,
          timestamp: Date.now()
        }));
        // Sync Publer API key to server workspace
        if (workspace?.id) {
          fetch(`/api/workspaces/${workspace.id}/publer-settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publerApiKey: settings.publerApiKey,
              platformAccounts: settings.platformAccounts || {},
            }),
          }).catch(() => {});
        }
      } else {
        setPublerStatus({ success: false, message: data.error || 'Connection failed' });
        // Clear cached status on failure
        localStorage.removeItem('publerConnectionStatus');
      }
    } catch (error) {
      setPublerStatus({ success: false, message: error.message });
      localStorage.removeItem('publerConnectionStatus');
    }
    setTestingPubler(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Settings</h2>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-sm text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/30 text-xs text-blue-300">
        Settings auto-save to your browser. They persist across sessions.
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Connected Accounts</h3>
        <p className="text-xs text-slate-500 mb-3">Assign a Publer account to each platform for this workspace. Test your Publer connection first to load available accounts.</p>
        <div className="space-y-3">
          {[
            { p: 'linkedin', label: 'LinkedIn', publerPlatforms: ['linkedin', 'in_profile', 'in_'] },
            { p: 'facebook', label: 'Facebook', publerPlatforms: ['facebook', 'fb_page', 'fb_'] },
            { p: 'instagram', label: 'Instagram', publerPlatforms: ['instagram', 'ig_business', 'ig_'] },
            { p: 'x', label: 'X (Twitter)', publerPlatforms: ['twitter', 'x'] }
          ].map(({ p, label, publerPlatforms }) => {
            const allAccounts = publerStatus?.accountsList || [];
            // Filter to accounts matching this platform type
            const matchingAccounts = allAccounts.filter(
              acc => publerPlatforms.some(pp => acc.platform?.toLowerCase()?.includes(pp))
            );
            const selectedId = settings.platformAccounts?.[p] || '';
            const selectedAccount = allAccounts.find(acc => acc.id === selectedId);
            const isAssigned = !!selectedId && !!selectedAccount;

            return (
              <div key={p} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={p} className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-white">{label}</p>
                      <p className={`text-xs ${isAssigned ? 'text-green-500' : 'text-slate-500'}`}>
                        {isAssigned ? `Assigned: ${selectedAccount.name}` : matchingAccounts.length > 0 ? 'Select an account below' : 'No matching accounts found'}
                      </p>
                    </div>
                  </div>
                  {isAssigned ? (
                    <span className="px-3 py-1.5 text-xs bg-green-900/50 text-green-400 rounded-lg border border-green-700/50">Connected</span>
                  ) : (
                    <span className="px-3 py-1.5 text-xs bg-slate-800 text-slate-500 rounded-lg">Not assigned</span>
                  )}
                </div>
                {matchingAccounts.length > 0 && (
                  <select
                    value={selectedId}
                    onChange={(e) => {
                      const newAccounts = { ...(settings.platformAccounts || {}), [p]: e.target.value || null };
                      if (!e.target.value) delete newAccounts[p];
                      handleChange('platformAccounts', newAccounts);
                    }}
                    className="mt-3 w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-slate-500"
                  >
                    <option value="">-- Select account --</option>
                    {matchingAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.platform})</option>
                    ))}
                  </select>
                )}
                {matchingAccounts.length === 0 && allAccounts.length > 0 && (
                  <select
                    value={selectedId}
                    onChange={(e) => {
                      const newAccounts = { ...(settings.platformAccounts || {}), [p]: e.target.value || null };
                      if (!e.target.value) delete newAccounts[p];
                      handleChange('platformAccounts', newAccounts);
                    }}
                    className="mt-3 w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-slate-500"
                  >
                    <option value="">-- Select any account --</option>
                    {allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.platform})</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Publer Integration</h3>
        <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Publer API Key</label>
            <input
              type="password"
              value={settings.publerApiKey || ''}
              onChange={(e) => handleChange('publerApiKey', e.target.value)}
              placeholder="Enter your Publer API key"
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">Get your API key from publer.io/settings/api</p>
          </div>
          <button
            onClick={testPublerConnection}
            disabled={testingPubler}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {testingPubler ? 'Testing...' : 'Test Connection'}
          </button>
          {publerStatus && (
            <div className={`p-3 rounded-lg text-sm ${publerStatus.success ? 'bg-green-900/50 text-green-300 border border-green-700/50' : 'bg-red-900/50 text-red-300 border border-red-700/50'}`}>
              {publerStatus.message}
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Workspace ID (optional)</label>
            <input
              type="text"
              value={settings.publerWorkspaceId || ''}
              onChange={(e) => handleChange('publerWorkspaceId', e.target.value)}
              placeholder="Enter your Publer workspace ID"
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoSchedule"
              checked={settings.autoSchedule || false}
              onChange={(e) => handleChange('autoSchedule', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0"
            />
            <label htmlFor="autoSchedule" className="text-sm text-slate-300 cursor-pointer">
              Auto-schedule posts to optimal times
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeImages"
              checked={settings.includeImages !== false}
              onChange={(e) => handleChange('includeImages', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0"
            />
            <label htmlFor="includeImages" className="text-sm text-slate-300 cursor-pointer">
              Include generated images with posts
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">API Keys</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Replicate API Key (for AI images)</label>
            <input
              type="password"
              value={settings.replicateApiKey || ''}
              onChange={(e) => handleChange('replicateApiKey', e.target.value)}
              placeholder="r8_..."
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
            <p className="text-xs text-slate-600 mt-1">Get at replicate.com/account/api-tokens (~$0.003/image)</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Claude API Key (for content generation)</label>
            <input
              type="password"
              value={settings.claudeApiKey || ''}
              onChange={(e) => handleChange('claudeApiKey', e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Default Preferences</h3>
        <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Default Image Template</label>
            <select
              value={settings.defaultTemplate || 'quote'}
              onChange={(e) => handleChange('defaultTemplate', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-slate-500"
            >
              <option value="quote">Quote</option>
              <option value="stat">Stat</option>
              <option value="question">Question</option>
              <option value="insight">Insight</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Default Content Pillar</label>
            <select
              value={settings.defaultPillar || 'ai'}
              onChange={(e) => handleChange('defaultPillar', e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-slate-500"
            >
              {(workspace?.pillars?.length ? workspace.pillars : pillars).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Workspace API Key */}
      {workspace && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-4">Workspace API Key</h3>
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3">
            <p className="text-xs text-slate-400">
              API keys allow external agents (like Marcus, Touchline's AI CMO) to submit content programmatically to this workspace.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-400 font-mono">
                {workspace.has_api_key ? '••••••••••••••••' : 'No API key generated'}
              </code>
              <button
                onClick={async () => {
                  try {
                    const resp = await fetch(`/api/workspaces/${workspace.id}/generate-api-key`, { method: 'POST' });
                    const data = await resp.json();
                    if (data.api_key) {
                      navigator.clipboard.writeText(data.api_key);
                      alert('New API key generated and copied to clipboard. Store it securely - it won\'t be shown again.');
                    }
                  } catch (e) {
                    alert('Failed to generate API key');
                  }
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {workspace.has_api_key ? 'Regenerate' : 'Generate Key'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              API base: <code className="text-slate-400">/api/v1/content/</code> — Endpoints: generate, submit, queue, analytics
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App
// Workspace switcher component
const WorkspaceSwitcher = ({ workspaces, activeWorkspace, onSwitch }) => {
  const [open, setOpen] = useState(false);
  const active = workspaces.find(w => w.id === activeWorkspace) || workspaces[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors"
      >
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
          {active?.name?.[0] || '?'}
        </div>
        <span className="text-sm text-white">{active?.name || 'Workspace'}</span>
        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => { onSwitch(ws.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors ${ws.id === activeWorkspace ? 'bg-slate-700/30' : ''}`}
              >
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                  {ws.name[0]}
                </div>
                <div>
                  <p className="text-sm text-white">{ws.name}</p>
                  <p className="text-[10px] text-slate-400">{ws.brand_config?.tagline || ws.slug}</p>
                </div>
                {ws.id === activeWorkspace && (
                  <svg className="w-4 h-4 text-blue-400 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function ContentStudio() {
  const [activeTab, setActiveTab] = useState('generate');

  // Workspace state
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try { return localStorage.getItem('activeWorkspace') || 'moonboots'; } catch { return 'moonboots'; }
  });

  // Fetch workspaces on mount
  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaces(data);
        }
      })
      .catch(() => {
        // Use fallback workspaces if API fails
        setWorkspaces([
          { id: 'moonboots', name: 'MoonBoots', slug: 'moonboots', brand_config: { tagline: 'Strategy to Execution' }, pillars: [] },
          { id: 'touchline', name: 'Touchline', slug: 'touchline', brand_config: { tagline: 'Empowering Grassroots Football' }, pillars: [] },
        ]);
      });
  }, []);

  const handleWorkspaceSwitch = (wsId) => {
    setActiveWorkspace(wsId);
    try { localStorage.setItem('activeWorkspace', wsId); } catch {}
  };

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace) || workspaces[0];

  // Posts queue with localStorage persistence (per workspace)
  const postsKey = `contentStudioPosts_${activeWorkspace}`;
  const [posts, setPosts] = useState(() => {
    try {
      const saved = localStorage.getItem(postsKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reload posts when workspace changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(postsKey);
      setPosts(saved ? JSON.parse(saved) : []);
    } catch {
      setPosts([]);
    }
  }, [activeWorkspace]);

  // Save posts to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(postsKey, JSON.stringify(posts));
    } catch (e) {
      console.error('Failed to save posts:', e);
    }
  }, [posts, postsKey]);

  const [performance] = useState(historicalPerformance);

  // Generator state (lifted to persist across tab switches)
  const [generatorState, setGeneratorState] = useState({
    topic: '',
    selectedPillar: 'ai',
    platforms: { linkedin: true, facebook: false, x: true, instagram: false },
    generatedContent: null,
    generatedImages: {},
    generatingImages: {},
    useOptimalTiming: true,
    selectedSlots: {},
    customScheduleTimes: {},
    scheduleMode: 'optimal',
    platformImageSettings: {
      linkedin: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
      facebook: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
      x: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
      instagram: { enabled: true, type: 'template', template: 'quote', theme: 'midnight' },
    },
    expandedPlatformSettings: null,
  });

  // Settings with localStorage persistence (per workspace)
  const settingsKey = `contentStudioSettings_${activeWorkspace}`;
  const defaultSettings = {
    publerApiKey: '',
    publerWorkspaceId: '',
    replicateApiKey: '',
    claudeApiKey: '',
    autoSchedule: true,
    includeImages: true,
    defaultTemplate: 'quote',
    defaultPillar: 'ai',
    platformAccounts: {},  // { linkedin: 'publer_account_id', facebook: '...', ... }
  };
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(settingsKey);
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Reload settings when workspace changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(settingsKey);
      setSettings(saved ? JSON.parse(saved) : defaultSettings);
    } catch {
      setSettings(defaultSettings);
    }
  }, [activeWorkspace]);

  // Save settings to localStorage when they change
  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(settingsKey, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const insights = useMemo(() => {
    const optimal = {};
    ['linkedin', 'x', 'instagram'].forEach(platform => {
      const platformPosts = performance.filter(p => p.platform === platform);
      if (platformPosts.length > 0) {
        const best = platformPosts.reduce((a, b) => (a.likes + a.comments * 2 + a.shares * 3) > (b.likes + b.comments * 2 + b.shares * 3) ? a : b);
        optimal[platform] = { day: best.dayOfWeek, hour: best.hour };
      }
    });
    return { optimal };
  }, [performance]);

  const handleGenerate = (newPost) => {
    setPosts(prev => [...prev, {
      ...newPost,
      id: Date.now(),
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
      scheduledFor: newPost.scheduledFor || null
    }]);
    setActiveTab('queue');
  };

  const handleRemoveImage = (postId) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, image: null } : p));
  };

  // Publish to Publer via backend proxy (avoids CORS issues)
  const publishToPubler = async (post) => {
    if (!settings.publerApiKey) {
      throw new Error('Publer API key not configured');
    }

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: settings.publerApiKey,
          post: {
            content: post.content,
            platform: post.platform,
            image: post.image,
            scheduledFor: post.scheduledFor || post.suggestedTime,
          },
          socialAccountId: settings.platformAccounts?.[post.platform] || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish to Publer');
      }

      return data;
    } catch (error) {
      console.error('Publer publish failed:', error);
      throw error;
    }
  };

  // Handle approve - publishes to Publer if API key is configured
  const handleApprove = async (id) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;

    // If Publer API key is configured and platform supports it, publish automatically
    if (settings.publerApiKey && post.platform !== 'x') {
      // Update status to publishing
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'publishing' } : p));

      try {
        await publishToPubler(post);
        setPosts(prev => prev.map(p => p.id === id ? {
          ...p,
          status: 'published',
          publishedAt: new Date().toISOString()
        } : p));
      } catch (error) {
        console.error('Failed to publish:', error);
        // Revert to approved status on error
        setPosts(prev => prev.map(p => p.id === id ? {
          ...p,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          error: error.message
        } : p));
        alert(`Failed to publish to Publer: ${error.message}`);
      }
    } else {
      // For X or when no Publer key, just mark as approved
      setPosts(prev => prev.map(p => p.id === id ? {
        ...p,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        scheduledFor: post.suggestedTime || null
      } : p));
    }
  };

  // Copy post content to clipboard for easy pasting into Publer
  const handleCopyToClipboard = async (post) => {
    try {
      await navigator.clipboard.writeText(post.content);
      alert('Content copied to clipboard! Paste into Publer to publish.');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const pendingCount = posts.filter(p => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            {workspaces.length > 1 && (
              <WorkspaceSwitcher
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                onSwitch={handleWorkspaceSwitch}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">{currentWorkspace?.name || 'Content Studio'}</span>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm">
              {currentWorkspace?.name?.[0] || 'C'}
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
          <TabButton active={activeTab === 'generate'} onClick={() => setActiveTab('generate')}>Generate</TabButton>
          <TabButton active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} count={pendingCount}>Queue</TabButton>
          <TabButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')}>Calendar</TabButton>
          <TabButton active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')}>Graphics</TabButton>
          <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')}>Insights</TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>Settings</TabButton>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className={activeTab === 'insights' ? '' : 'max-w-2xl'}>
          {activeTab === 'generate' && <ContentGenerator onGenerate={handleGenerate} insights={insights} settings={settings} generatorState={generatorState} setGeneratorState={setGeneratorState} workspace={currentWorkspace} />}
          {activeTab === 'queue' && <ApprovalQueue posts={posts} onApprove={handleApprove} onReject={(id) => setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p))} onUnapprove={(id) => setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'pending', approvedAt: null, error: null } : p))} onRemoveImage={handleRemoveImage} onCopy={handleCopyToClipboard} onEdit={(id, newContent) => setPosts(prev => prev.map(p => p.id === id ? { ...p, content: newContent } : p))} onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))} />}
          {activeTab === 'calendar' && <CalendarView posts={posts} />}
          {activeTab === 'graphics' && <QuoteCardMaker />}
          {activeTab === 'insights' && <InsightsDashboard performance={performance} />}
          {activeTab === 'settings' && <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} workspace={currentWorkspace} />}
        </div>
      </main>
    </div>
  );
}
