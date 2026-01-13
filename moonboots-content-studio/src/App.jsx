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
  x: { frequency: { min: 7, max: 21, unit: 'week' }, bestDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], bestHours: [9, 12, 15, 17] },
  instagram: { frequency: { min: 3, max: 5, unit: 'week' }, bestDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'], bestHours: [11, 13, 18, 20] },
};

const Logo = () => (
  <div className="flex flex-col">
    <div className="flex items-center">
      <span className="text-lg font-medium text-white tracking-tight">m</span>
      <div className="w-4 h-4 relative mx-0.5">
        <div className="absolute inset-0 rounded-full bg-white" />
        <div className="absolute rounded-full bg-slate-900" style={{ width: '70%', height: '70%', top: '15%', left: '35%' }} />
      </div>
      <span className="text-lg font-medium text-white tracking-tight">nboots</span>
    </div>
    <span className="text-[10px] font-light text-slate-400 tracking-widest self-end -mt-1">content studio</span>
  </div>
);

const PlatformIcon = ({ platform, className = "w-5 h-5" }) => {
  const icons = {
    linkedin: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    x: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    instagram: <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  };
  return icons[platform] || null;
};

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    published: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <span className={`px-2 py-1 text-xs rounded-full border ${styles[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
};

const TabButton = ({ active, onClick, children, count }) => (
  <button onClick={onClick} className={`px-4 py-2 text-sm font-medium transition-all ${active ? 'text-white border-b-2 border-white' : 'text-slate-400 hover:text-slate-200'}`}>
    {children}
    {count !== undefined && <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${active ? 'bg-white text-slate-900' : 'bg-slate-700 text-slate-300'}`}>{count}</span>}
  </button>
);

// Generate template-based image using canvas
const generateTemplateImage = (content, template, platform) => {
  const canvas = document.createElement('canvas');
  const size = platform === 'instagram' ? 1080 : 1200;
  const height = platform === 'x' ? 675 : size;
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Extract headline and body from content
  const lines = content.split('\n').filter(l => l.trim());
  const headline = lines[0] || '';
  const body = lines.slice(1).join(' ').substring(0, 200);

  // Template styles
  const templates = {
    quote: {
      gradient: ['#0f172a', '#1e3a5f'],
      accent: '#3b82f6',
    },
    stat: {
      gradient: ['#1a1a2e', '#16213e'],
      accent: '#10b981',
    },
    question: {
      gradient: ['#1f1f1f', '#2d2d2d'],
      accent: '#f59e0b',
    },
    insight: {
      gradient: ['#0c0c0c', '#1a1a1a'],
      accent: '#8b5cf6',
    },
  };

  const t = templates[template] || templates.quote;

  // Draw gradient background
  const grd = ctx.createLinearGradient(0, 0, size, height);
  grd.addColorStop(0, t.gradient[0]);
  grd.addColorStop(1, t.gradient[1]);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, height);

  // Add subtle pattern
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < size; i += 30) {
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

  // Draw logo
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(size - 100, 80, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.gradient[0];
  ctx.beginPath();
  ctx.arc(size - 93, 80, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 16px system-ui';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('moonboots', size - 200, 86);

  // Draw headline
  ctx.font = `bold ${Math.round(size * 0.055)}px system-ui`;
  ctx.fillStyle = '#ffffff';
  const headlineLines = wrapText(ctx, headline, size - 160);
  let y = 220;
  headlineLines.slice(0, 3).forEach(line => {
    ctx.fillText(line, 80, y);
    y += size * 0.07;
  });

  // Draw body text
  if (body) {
    ctx.font = `${Math.round(size * 0.035)}px system-ui`;
    ctx.fillStyle = '#94a3b8';
    const bodyLines = wrapText(ctx, body, size - 160);
    y += 20;
    bodyLines.slice(0, 6).forEach(line => {
      ctx.fillText(line, 80, y);
      y += size * 0.045;
    });
  }

  // Footer
  ctx.font = '14px system-ui';
  ctx.fillStyle = '#64748b';
  ctx.fillText('moonbootsconsultancy.net', 80, height - 50);

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

// Content Generator with optimal timing and images
const ContentGenerator = ({ onGenerate, insights, settings }) => {
  const [topic, setTopic] = useState('');
  const [selectedPillar, setSelectedPillar] = useState('ai');
  const [platforms, setPlatforms] = useState({ linkedin: true, x: true, instagram: false });
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [generatedImages, setGeneratedImages] = useState({});
  const [generatingImages, setGeneratingImages] = useState({});
  const [useOptimalTiming, setUseOptimalTiming] = useState(true);
  const [imageTemplate, setImageTemplate] = useState('quote');

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedImages({});
    await new Promise(resolve => setTimeout(resolve, 2000));

    const content = {
      linkedin: `${topic}\n\nThis isn't about chasing trends—it's about building systems that last.\n\nThree things I've learned:\n\n1. Start with the problem, not the technology\n2. Simple beats sophisticated every time\n3. Your users will tell you what they need—if you listen\n\nThe organisations getting this right aren't the loudest. They're the most curious.`,
      x: `${topic}\n\nMost get this wrong.\n\nThey start with tools. They should start with problems.\n\nClarity > complexity. Every time.`,
      instagram: `${topic}\n\nAfter years of working with founders on this, one thing is clear:\n\nThe best technology serves people—not the other way around.\n\n#Strategy #AI #Innovation #Leadership`,
    };

    setGeneratedContent(content);

    // Auto-generate images for each platform
    Object.keys(platforms).forEach(platform => {
      if (platforms[platform] && content[platform]) {
        setGeneratingImages(prev => ({ ...prev, [platform]: true }));
        setTimeout(() => {
          const imageUrl = generateTemplateImage(content[platform], imageTemplate, platform);
          setGeneratedImages(prev => ({ ...prev, [platform]: imageUrl }));
          setGeneratingImages(prev => ({ ...prev, [platform]: false }));
        }, 500 + Math.random() * 1000);
      }
    });

    setGenerating(false);
  };

  const handleRegenerateImage = (platform, content) => {
    setGeneratingImages(prev => ({ ...prev, [platform]: true }));
    setTimeout(() => {
      const imageUrl = generateTemplateImage(content, imageTemplate, platform);
      setGeneratedImages(prev => ({ ...prev, [platform]: imageUrl }));
      setGeneratingImages(prev => ({ ...prev, [platform]: false }));
    }, 800);
  };

  const handleAddToQueue = (platform) => {
    if (generatedContent?.[platform]) {
      const optimalSlot = useOptimalTiming && insights?.optimal?.[platform];
      onGenerate({
        content: generatedContent[platform],
        platform,
        pillar: pillars.find(p => p.id === selectedPillar)?.name,
        suggestedTime: optimalSlot ? `${optimalSlot.day} ${optimalSlot.hour}:00` : null,
        image: generatedImages[platform] || null,
      });
      setGeneratedContent(prev => ({ ...prev, [platform]: null }));
      setGeneratedImages(prev => ({ ...prev, [platform]: null }));
    }
  };

  return (
    <div className="space-y-6">
      {insights?.optimal && (
        <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-800/30">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-300">Your Optimal Posting Windows</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useOptimalTiming} onChange={(e) => setUseOptimalTiming(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0" />
              <span className="text-xs text-slate-400">Auto-schedule</span>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {Object.entries(insights.optimal).map(([platform, data]) => (
              <div key={platform} className="flex items-center gap-2">
                <PlatformIcon platform={platform} className="w-3 h-3 text-slate-400" />
                <span className="text-slate-300">{data.day} {data.hour}:00</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-slate-400 mb-2">Topic or idea</label>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Why most AI strategies fail in the first year..." className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none" rows={3} />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Content pillar</label>
        <div className="flex flex-wrap gap-2">
          {pillars.map(pillar => (
            <button key={pillar.id} onClick={() => setSelectedPillar(pillar.id)} className={`px-3 py-1.5 text-sm rounded-full border transition-all ${selectedPillar === pillar.id ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:border-slate-500'}`}>
              {pillar.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Generate for</label>
        <div className="flex gap-4">
          {['linkedin', 'x', 'instagram'].map(platform => (
            <label key={platform} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={platforms[platform]} onChange={(e) => setPlatforms(prev => ({ ...prev, [platform]: e.target.checked }))} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-white focus:ring-0" />
              <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">{platform === 'x' ? 'X' : platform}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Image template</label>
        <div className="flex gap-2">
          {['quote', 'stat', 'question', 'insight'].map(t => (
            <button key={t} onClick={() => setImageTemplate(t)} className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${imageTemplate === t ? 'bg-white text-slate-900' : 'bg-slate-800/50 text-slate-300 border-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={!topic || generating} className="w-full py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {generating ? <><div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />Generating...</> : <>Generate Content</>}
      </button>

      {generatedContent && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-sm font-medium text-slate-300">Generated Content</h3>
          {Object.entries(generatedContent).map(([platform, content]) => content && platforms[platform] && (
            <div key={platform} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">{platform === 'x' ? 'X (Manual)' : platform}</span>
                  {useOptimalTiming && insights?.optimal?.[platform] && <span className="text-xs text-blue-400">→ {insights.optimal[platform].day} {insights.optimal[platform].hour}:00</span>}
                </div>
                <button onClick={() => handleAddToQueue(platform)} className="px-3 py-1 text-xs bg-white text-slate-900 rounded hover:bg-slate-100">Add to Queue</button>
              </div>

              <div className="flex gap-4">
                <p className="text-sm text-slate-300 whitespace-pre-wrap flex-1">{content}</p>

                {/* Image preview */}
                <div className="flex-shrink-0">
                  {generatingImages[platform] ? (
                    <div className="w-32 h-32 bg-slate-700/50 rounded-lg flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : generatedImages[platform] ? (
                    <div className="relative group">
                      <img src={generatedImages[platform]} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <button onClick={() => handleRegenerateImage(platform, content)} className="p-1.5 bg-white/20 rounded hover:bg-white/30" title="Regenerate">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <a href={generatedImages[platform]} download={`${platform}-image.png`} className="p-1.5 bg-white/20 rounded hover:bg-white/30" title="Download">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
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
const ApprovalQueue = ({ posts, onApprove, onReject, onRemoveImage }) => {
  const pending = posts.filter(p => p.status === 'pending');
  const [expandedImage, setExpandedImage] = useState(null);

  if (pending.length === 0) return <div className="text-center py-12"><div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center text-2xl">✓</div><p className="text-slate-400">No posts awaiting approval</p></div>;

  return (
    <div className="space-y-4">
      {pending.map(post => (
        <div key={post.id} className="p-5 bg-slate-800/50 rounded-xl border border-slate-700/50">
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
                <button
                  onClick={() => onRemoveImage(post.id)}
                  className="mt-1 text-xs text-slate-500 hover:text-red-400 w-full text-center"
                >
                  Remove image
                </button>
              </div>
            )}
          </div>

          {post.suggestedTime && <p className="text-xs text-blue-400 mb-4">Optimal time: {post.suggestedTime}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => onApprove(post.id)} className="px-4 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">Approve</button>
            <button className="px-4 py-2 text-sm bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">Edit</button>
            <button onClick={() => onReject(post.id)} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Reject</button>
          </div>
        </div>
      ))}

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
const SettingsPanel = ({ settings, onSettingsChange }) => {
  const [saveStatus, setSaveStatus] = useState('');

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 2000);
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
        <div className="space-y-3">
          {[
            { p: 'linkedin', label: 'LinkedIn', sub: 'Auto-post via Publer' },
            { p: 'instagram', label: 'Instagram', sub: 'Auto-post via Publer' },
            { p: 'x', label: 'X (Twitter)', sub: 'Manual posting only', manual: true }
          ].map(({ p, label, sub, manual }) => (
            <div key={p} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <PlatformIcon platform={p} className="w-5 h-5 text-slate-400" />
                <div><p className="text-sm text-white">{label}</p><p className={`text-xs ${manual ? 'text-yellow-500' : 'text-slate-500'}`}>{sub}</p></div>
              </div>
              {manual ? <span className="px-3 py-1.5 text-xs bg-slate-800 text-slate-500 rounded-lg">N/A</span> : <button className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">Connect</button>}
            </div>
          ))}
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
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Workspace ID</label>
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
            <label className="text-xs text-slate-500 mb-1 block">OpenAI API Key (for AI images)</label>
            <input
              type="password"
              value={settings.openaiApiKey || ''}
              onChange={(e) => handleChange('openaiApiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
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
              {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App
export default function ContentStudio() {
  const [activeTab, setActiveTab] = useState('generate');
  const [posts, setPosts] = useState([
    { id: 1, content: "The best AI strategy isn't about the technology...", platform: 'linkedin', status: 'pending', pillar: 'AI Strategy', createdAt: '2025-01-12', scheduledFor: '2025-01-14 09:00', image: null },
    { id: 2, content: "Web3 doesn't need more hype. It needs more builders.", platform: 'x', status: 'pending', pillar: 'Web3', createdAt: '2025-01-12', scheduledFor: null, image: null },
    { id: 3, content: "Athletes have millions of followers but don't own the relationship.", platform: 'instagram', status: 'approved', pillar: 'Community Building', createdAt: '2025-01-11', scheduledFor: '2025-01-13 12:00', image: null },
  ]);
  const [performance] = useState(historicalPerformance);

  // Settings with localStorage persistence
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('contentStudioSettings');
      return saved ? JSON.parse(saved) : {
        publerApiKey: '',
        publerWorkspaceId: '',
        openaiApiKey: '',
        claudeApiKey: '',
        autoSchedule: true,
        includeImages: true,
        defaultTemplate: 'quote',
        defaultPillar: 'ai',
      };
    } catch {
      return {
        publerApiKey: '',
        publerWorkspaceId: '',
        openaiApiKey: '',
        claudeApiKey: '',
        autoSchedule: true,
        includeImages: true,
        defaultTemplate: 'quote',
        defaultPillar: 'ai',
      };
    }
  });

  // Save settings to localStorage when they change
  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('contentStudioSettings', JSON.stringify(newSettings));
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
      scheduledFor: null
    }]);
    setActiveTab('queue');
  };

  const handleRemoveImage = (postId) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, image: null } : p));
  };

  const pendingCount = posts.filter(p => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">js@moonbootsconsultancy.net</span>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm">JS</div>
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
          {activeTab === 'generate' && <ContentGenerator onGenerate={handleGenerate} insights={insights} settings={settings} />}
          {activeTab === 'queue' && <ApprovalQueue posts={posts} onApprove={(id) => setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', scheduledFor: '2025-01-15 09:00' } : p))} onReject={(id) => setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p))} onRemoveImage={handleRemoveImage} />}
          {activeTab === 'calendar' && <CalendarView posts={posts} />}
          {activeTab === 'graphics' && <QuoteCardMaker />}
          {activeTab === 'insights' && <InsightsDashboard performance={performance} />}
          {activeTab === 'settings' && <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />}
        </div>
      </main>
    </div>
  );
}
