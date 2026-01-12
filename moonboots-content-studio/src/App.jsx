import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { api, checkBackendAvailable } from './lib/api';
import { generateContent as claudeGenerateContent } from './lib/claude';

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
  <div className="flex items-center gap-3">
    <div className="relative">
      <svg width="32" height="32" viewBox="0 0 32 32" className="text-white">
        <defs>
          <linearGradient id="moonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="url(#moonGradient)" />
        <circle cx="22" cy="12" r="11" fill="#020617" />
      </svg>
      <div className="absolute -inset-1 bg-white/20 rounded-full blur-md -z-10" />
    </div>
    <div className="flex flex-col">
      <span className="text-xl font-semibold text-white tracking-tight leading-none">moonboots</span>
      <span className="text-[10px] font-medium text-slate-400 tracking-[0.2em] uppercase">content studio</span>
    </div>
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
  <button
    onClick={onClick}
    className={`relative px-5 py-3 text-sm font-medium transition-all duration-300 ${
      active
        ? 'text-white'
        : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    {children}
    {count !== undefined && (
      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full transition-all duration-300 ${
        active
          ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white'
          : 'bg-slate-800 text-slate-400'
      }`}>
        {count}
      </span>
    )}
    {active && (
      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 rounded-full" />
    )}
  </button>
);

// Instagram image templates
const instagramTemplates = [
  { id: 'quote', name: 'Quote Card', description: 'Bold text on gradient background', icon: '💬' },
  { id: 'tips', name: 'Tips Carousel', description: 'Numbered tips with icons', icon: '📝' },
  { id: 'stat', name: 'Stat Highlight', description: 'Big number with context', icon: '📊' },
  { id: 'before-after', name: 'Before/After', description: 'Comparison split view', icon: '↔️' },
  { id: 'question', name: 'Question Hook', description: 'Engaging question overlay', icon: '❓' },
];

// Topic suggestions by pillar (for when no API key)
// Topic suggestions aligned with funnel strategy:
// AI, Web3, Transformation → moonbootsconsultancy.net
// Community, Sport → moments.deepfabrik.com
const topicSuggestions = {
  ai: [
    "Why most AI strategies fail in the first year (and how to avoid it)",
    "The gap between 'AI curious' and 'AI ready' isn't technical—it's strategic",
    "Three questions I ask every founder before we talk about AI",
    "Hot take: Most 'AI transformations' are just expensive spreadsheet upgrades",
    "The best AI implementations I've seen all started the same way",
    "Why your AI pilot succeeded but your rollout failed",
    "Agentic AI is coming. Is your business ready to let go of control?",
    "The real cost of waiting another year to figure out AI",
  ],
  web3: [
    "Stop calling it Web3. Start calling it what it is: infrastructure for trust",
    "Decentralisation isn't about removing control—it's about distributing trust",
    "The next wave of Web3 won't look like the last one (and that's good)",
    "Why tokenomics matter less than you think (and what matters more)",
    "The infrastructure layer nobody's talking about",
    "Web3 for grown-ups: What actually works vs. what's just hype",
  ],
  community: [
    "Community isn't a feature. It's the product",
    "The creator economy's dirty secret: most creators don't own their audience",
    "Why engagement metrics are lying to you about your community",
    "Creators don't want more tools. They want direct relationships with fans",
    "The difference between an audience and a community (and why it matters)",
    "Your followers aren't yours. Here's how to change that",
    "The hidden cost of building your audience on rented land",
  ],
  transformation: [
    "The best technology decisions weren't about technology at all",
    "Digital transformation is 20% technology, 80% change management",
    "Why your transformation roadmap is already outdated",
    "The hidden cost of standing still while competitors transform",
    "Three signs your transformation is actually working",
    "Why I tell founders to slow down before speeding up on transformation",
  ],
  sport: [
    "What coaching U12 football taught me about building high-performing teams",
    "Athletes have millions of followers but don't own a single relationship",
    "The future of fan engagement isn't about more content—it's about ownership",
    "Why sports organisations are 10 years behind on technology (and how to catch up)",
    "Every athlete will need a direct-to-fan strategy. Here's why",
    "The agent-athlete-brand relationship is broken. Technology can fix it",
  ],
};

// Content Generator with optimal timing - state lifted from parent
const ContentGenerator = ({
  onGenerate,
  insights,
  claudeApiKey,
  // Lifted state props
  topic,
  setTopic,
  selectedPillar,
  setSelectedPillar,
  platforms,
  setPlatforms,
  generatedContent,
  setGeneratedContent,
  useOptimalTiming,
  setUseOptimalTiming,
  instagramTemplate,
  setInstagramTemplate,
}) => {
  const [generating, setGenerating] = useState(false);
  const [generatingTopic, setGeneratingTopic] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateTopic = async () => {
    setGeneratingTopic(true);
    const pillarName = pillars.find(p => p.id === selectedPillar)?.name || 'AI Strategy';

    try {
      if (claudeApiKey) {
        // Use Claude API to generate topic
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `Generate a single compelling social media post topic/hook for a thought leader in the "${pillarName}" space. The topic should be provocative, insightful, and conversation-starting. Return ONLY the topic text, nothing else. Keep it under 80 characters.`
            }]
          })
        });

        if (!response.ok) throw new Error('Failed to generate topic');
        const data = await response.json();
        setTopic(data.content[0].text.trim());
      } else {
        // Use mock suggestions
        await new Promise(resolve => setTimeout(resolve, 500));
        const suggestions = topicSuggestions[selectedPillar] || topicSuggestions.ai;
        const randomTopic = suggestions[Math.floor(Math.random() * suggestions.length)];
        setTopic(randomTopic);
      }
    } catch (err) {
      console.error('Topic generation error:', err);
      // Fallback to mock on error
      const suggestions = topicSuggestions[selectedPillar] || topicSuggestions.ai;
      const randomTopic = suggestions[Math.floor(Math.random() * suggestions.length)];
      setTopic(randomTopic);
    } finally {
      setGeneratingTopic(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    const pillarName = pillars.find(p => p.id === selectedPillar)?.name || 'AI Strategy';

    try {
      // Use real Claude API if key is configured
      if (claudeApiKey) {
        const result = await claudeGenerateContent({
          topic,
          pillar: pillarName,
          platforms,
          apiKey: claudeApiKey,
          instagramTemplate: platforms.instagram ? instagramTemplate : null,
        });
        setGeneratedContent(result);
      } else {
        // Fallback to mock content if no API key
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockContent = {};
        if (platforms.linkedin) {
          mockContent.linkedin = `${topic}\n\nThis isn't about chasing trends—it's about building systems that last.\n\nThree things I've learned:\n\n1. Start with the problem, not the technology\n2. Simple beats sophisticated every time\n3. Your users will tell you what they need—if you listen\n\nThe organisations getting this right aren't the loudest. They're the most curious.`;
        }
        if (platforms.x) {
          mockContent.x = `${topic}\n\nMost get this wrong.\n\nThey start with tools. They should start with problems.\n\nClarity > complexity. Every time.`;
        }
        if (platforms.instagram) {
          const template = instagramTemplates.find(t => t.id === instagramTemplate);
          const templateHint = template ? `\n\n[Template: ${template.name} - ${template.description}]` : '';
          mockContent.instagram = `${topic} ✨\n\nAfter years of working with founders on this, one thing is clear:\n\nThe best technology serves people—not the other way around.\n\n#Strategy #AI #Innovation #Leadership${templateHint}`;
        }
        setGeneratedContent(mockContent);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddToQueue = (platform) => {
    if (generatedContent?.[platform]) {
      const optimalSlot = useOptimalTiming && insights?.optimal?.[platform];
      onGenerate({
        content: generatedContent[platform],
        platform,
        pillar: pillars.find(p => p.id === selectedPillar)?.name,
        suggestedTime: optimalSlot ? `${optimalSlot.day} ${optimalSlot.hour}:00` : null,
        imageTemplate: platform === 'instagram' ? instagramTemplate : null,
      });
      setGeneratedContent(prev => ({ ...prev, [platform]: null }));
    }
  };

  return (
    <div className="space-y-8">
      {insights?.optimal && (
        <div className="relative p-5 bg-gradient-to-br from-blue-950/50 to-slate-900/50 rounded-2xl border border-blue-500/20 backdrop-blur-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
          <div className="relative flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🎯</span>
              Optimal Posting Windows
            </h4>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={useOptimalTiming} onChange={(e) => setUseOptimalTiming(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0 focus:ring-offset-0" />
              <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Auto-schedule</span>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(insights.optimal).map(([platform, data]) => (
              <div key={platform} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                <PlatformIcon platform={platform} className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-200 font-medium">{data.day} {data.hour}:00</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-300">Topic or idea</label>
          <button
            onClick={handleGenerateTopic}
            disabled={generatingTopic}
            className="px-3 py-1.5 text-xs bg-gradient-to-r from-slate-800 to-slate-800 hover:from-blue-900/50 hover:to-violet-900/50 text-slate-300 rounded-lg border border-slate-700/50 hover:border-blue-500/30 disabled:opacity-50 flex items-center gap-2 transition-all duration-300"
          >
            {generatingTopic ? (
              <><div className="w-3 h-3 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin" />Thinking...</>
            ) : (
              <>🎲 Suggest Topic</>
            )}
          </button>
        </div>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Why most AI strategies fail in the first year..." className="w-full px-4 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900/70 resize-none transition-all duration-300" rows={3} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Content pillar</label>
        <div className="flex flex-wrap gap-2">
          {pillars.map(pillar => (
            <button
              key={pillar.id}
              onClick={() => setSelectedPillar(pillar.id)}
              className={`px-4 py-2 text-sm rounded-xl border transition-all duration-300 ${
                selectedPillar === pillar.id
                  ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white border-transparent shadow-lg shadow-blue-500/20'
                  : 'bg-slate-900/50 text-slate-300 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
              }`}
            >
              {pillar.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Generate for</label>
        <div className="flex gap-3">
          {['linkedin', 'x', 'instagram'].map(platform => (
            <label
              key={platform}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-300 ${
                platforms[platform]
                  ? 'bg-slate-800/70 border-slate-600'
                  : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input type="checkbox" checked={platforms[platform]} onChange={(e) => setPlatforms(prev => ({ ...prev, [platform]: e.target.checked }))} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0 focus:ring-offset-0" />
              <PlatformIcon platform={platform} className={`w-4 h-4 transition-colors ${platforms[platform] ? 'text-slate-200' : 'text-slate-500'}`} />
              <span className={`text-sm capitalize transition-colors ${platforms[platform] ? 'text-slate-200' : 'text-slate-400'}`}>{platform === 'x' ? 'X' : platform}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Instagram Image Template Selection */}
      {platforms.instagram && (
        <div className="relative p-5 bg-gradient-to-br from-pink-950/40 to-slate-900/50 rounded-2xl border border-pink-500/20 backdrop-blur-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
          <label className="relative block text-sm font-semibold text-pink-300 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-pink-500/20 flex items-center justify-center text-xs">📸</span>
            Instagram Image Template
          </label>
          <div className="grid grid-cols-2 gap-2">
            {instagramTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setInstagramTemplate(template.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  instagramTemplate === template.id
                    ? 'bg-pink-500/20 border-pink-500/50 text-white'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{template.icon}</span>
                  <span className="text-sm font-medium">{template.name}</span>
                </div>
                <p className="text-xs text-slate-400">{template.description}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">Template will be applied when creating the image in the Graphics tab</p>
        </div>
      )}

      {!claudeApiKey && (
        <div className="p-4 bg-amber-950/30 rounded-xl border border-amber-500/20 text-sm text-amber-400 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <p className="font-medium">Demo Mode</p>
            <p className="text-xs text-slate-400 mt-1">Add your Claude API key in Settings for AI-generated content.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/30 rounded-xl border border-red-500/20 text-sm text-red-400 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!topic || generating}
        className="group relative w-full py-4 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 overflow-hidden"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        {generating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <span className="text-lg">✨</span>
            Generate Content
          </>
        )}
      </button>

      {generatedContent && (
        <div className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Generated Content
          </h3>
          {Object.entries(generatedContent).map(([platform, content]) => content && platforms[platform] && (
            <div key={platform} className="p-5 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <PlatformIcon platform={platform} className="w-4 h-4 text-slate-300" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-200 capitalize">{platform === 'x' ? 'X (Manual)' : platform}</span>
                    {useOptimalTiming && insights?.optimal?.[platform] && (
                      <span className="block text-xs text-blue-400">🎯 {insights.optimal[platform].day} {insights.optimal[platform].hour}:00</span>
                    )}
                  </div>
                  {platform === 'instagram' && instagramTemplate && (
                    <span className="text-xs px-2 py-1 bg-pink-500/20 text-pink-400 rounded-lg">📸 {instagramTemplates.find(t => t.id === instagramTemplate)?.name}</span>
                  )}
                </div>
                <button
                  onClick={() => handleAddToQueue(platform)}
                  className="px-4 py-2 text-sm bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
                >
                  Add to Queue →
                </button>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Generation History - shows previous prompt if content was cleared */}
      {!generatedContent && topic && (
        <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50 text-xs text-slate-500">
          <span className="text-slate-400">Last topic:</span> "{topic.substring(0, 100)}{topic.length > 100 ? '...' : ''}"
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
      recs.push({ icon: '🎯', text: `"${sortedPillars[0][0]}" content gets ${diff}% more engagement than other pillars` });
    }
    const sortedDays = Object.entries(insights.dayData).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
    if (sortedDays.length > 0) recs.push({ icon: '⏰', text: `${sortedDays[0][0]}s are your best day (${sortedDays[0][1].avgEngagement} avg engagement)` });
    const sortedHours = Object.entries(insights.hourData).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
    if (sortedHours.length > 0) recs.push({ icon: '🕐', text: `Posts at ${sortedHours[0][0]}:00 perform best` });
    const leadPillar = Object.entries(insights.pillarData).sort((a, b) => b[1].leads - a[1].leads)[0];
    if (leadPillar?.[1].leads > 0) recs.push({ icon: '💼', text: `"${leadPillar[0]}" generates the most leads (${leadPillar[1].leads} total)` });
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
        <h3 className="text-sm font-medium text-slate-300 mb-4">🧠 Learning Insights</h3>
        <div className="p-4 bg-gradient-to-br from-blue-900/30 to-slate-800/50 rounded-xl border border-blue-800/30 space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-lg">{rec.icon}</span>
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

// Approval Queue
const ApprovalQueue = ({ posts, onApprove, onReject, onLogPerformance }) => {
  const pending = posts.filter(p => p.status === 'pending');
  const approved = posts.filter(p => p.status === 'approved');

  return (
    <div className="space-y-8">
      {/* Pending Posts */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Pending Approval ({pending.length})</h3>
        {pending.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-slate-800">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-xl">✓</div>
            <p className="text-slate-500 text-sm">No posts awaiting approval</p>
          </div>
        ) : (
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
                <p className="text-slate-200 text-sm whitespace-pre-wrap mb-4">{post.content}</p>
                {post.suggestedTime && <p className="text-xs text-blue-400 mb-4">🎯 Optimal time: {post.suggestedTime}</p>}
                <div className="flex items-center gap-2">
                  <button onClick={() => onApprove(post.id)} className="px-4 py-2 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">✓ Approve</button>
                  <button className="px-4 py-2 text-sm bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">✎ Edit</button>
                  <button onClick={() => onReject(post.id)} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Posts - Ready to Publish */}
      {approved.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-4">Ready to Post ({approved.length})</h3>
          <div className="space-y-4">
            {approved.map(post => (
              <div key={post.id} className="p-5 bg-slate-800/50 rounded-xl border border-green-900/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={post.platform} className="w-5 h-5 text-slate-400" />
                    <span className="text-xs px-2 py-1 bg-slate-700/50 rounded-full text-slate-300">{post.pillar}</span>
                    {post.scheduledFor && <span className="text-xs text-slate-500">Scheduled: {post.scheduledFor}</span>}
                  </div>
                  <StatusBadge status={post.status} />
                </div>
                <p className="text-slate-200 text-sm whitespace-pre-wrap mb-4">{post.content}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(post.content)}
                    className="px-4 py-2 text-sm bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => onLogPerformance(post)}
                    className="px-4 py-2 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                  >
                    📊 Log Performance
                  </button>
                </div>
              </div>
            ))}
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
            <span className="text-xs text-slate-500">{post.scheduledFor}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Graphics Image Maker - Templates and Platform Support
const GraphicsImageMaker = () => {
  const [content, setContent] = useState('');
  const [secondaryContent, setSecondaryContent] = useState('');
  const [style, setStyle] = useState('dark');
  const [template, setTemplate] = useState('quote');
  const [platform, setPlatform] = useState('instagram');
  const [downloading, setDownloading] = useState(false);

  const templates = [
    { id: 'quote', name: 'Quote Card', description: 'Bold text on gradient background', icon: '💬' },
    { id: 'tips', name: 'Tips List', description: 'Numbered tips with visual hierarchy', icon: '📝' },
    { id: 'stat', name: 'Stat Highlight', description: 'Big number with context', icon: '📊' },
    { id: 'before-after', name: 'Before/After', description: 'Comparison split view', icon: '↔️' },
    { id: 'question', name: 'Question Hook', description: 'Engaging question overlay', icon: '❓' },
  ];

  const platforms = [
    { id: 'instagram', name: 'Instagram', width: 1080, height: 1080, aspect: '1:1' },
    { id: 'x', name: 'X (Twitter)', width: 1200, height: 675, aspect: '16:9' },
    { id: 'linkedin', name: 'LinkedIn', width: 1200, height: 627, aspect: '1.91:1' },
  ];

  const styleConfigs = {
    dark: { bg: '#0f172a', text: '#ffffff', accent: '#94a3b8', gradient: null },
    light: { bg: '#ffffff', text: '#0f172a', accent: '#64748b', gradient: null },
    gradient: { bg: '#0f172a', text: '#ffffff', accent: '#cbd5e1', gradient: ['#0f172a', '#1e3a5f'] },
    vibrant: { bg: '#0f172a', text: '#ffffff', accent: '#a78bfa', gradient: ['#4f46e5', '#7c3aed'] },
  };

  const tailwindStyles = {
    dark: { bg: 'bg-slate-900', text: 'text-white', accent: 'text-slate-400' },
    light: { bg: 'bg-white', text: 'text-slate-900', accent: 'text-slate-500' },
    gradient: { bg: 'bg-gradient-to-br from-slate-900 to-blue-900', text: 'text-white', accent: 'text-slate-300' },
    vibrant: { bg: 'bg-gradient-to-br from-indigo-600 to-violet-600', text: 'text-white', accent: 'text-violet-200' },
  };

  const s = tailwindStyles[style];
  const config = styleConfigs[style];
  const selectedPlatform = platforms.find(p => p.id === platform);
  const selectedTemplate = templates.find(t => t.id === template);

  const getPlaceholder = () => {
    switch (template) {
      case 'quote': return 'Enter your quote or key insight...';
      case 'tips': return 'Enter tips separated by new lines...\n1. First tip\n2. Second tip\n3. Third tip';
      case 'stat': return 'Enter the big number (e.g., 73%)';
      case 'before-after': return 'Enter the "Before" text...';
      case 'question': return 'Enter your engaging question...';
      default: return 'Enter your content...';
    }
  };

  const getSecondaryPlaceholder = () => {
    switch (template) {
      case 'stat': return 'Enter context (e.g., of companies fail in year one)';
      case 'before-after': return 'Enter the "After" text...';
      default: return '';
    }
  };

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

  const wrapText = (ctx, text, maxWidth, lineHeight) => {
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

  const handleDownload = async () => {
    if (!content) return;
    setDownloading(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const { width, height } = selectedPlatform;
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

      // Template-specific rendering
      const contentArea = { x: padding, y: logoY + 60, width: width - padding * 2, height: height - logoY - 120 };

      if (template === 'quote') {
        const fontSize = Math.min(width, height) * 0.039;
        ctx.font = `300 ${fontSize}px system-ui, -apple-system, sans-serif`;
        const lines = wrapText(ctx, content, contentArea.width, fontSize * 1.4);
        const totalHeight = lines.length * fontSize * 1.4;
        let y = contentArea.y + (contentArea.height - totalHeight) / 2 + fontSize;
        ctx.fillStyle = config.text;
        for (let line of lines) {
          ctx.fillText(line, contentArea.x, y);
          y += fontSize * 1.4;
        }
      } else if (template === 'tips') {
        const tips = content.split('\n').filter(t => t.trim());
        const fontSize = Math.min(width, height) * 0.028;
        const lineHeight = fontSize * 2;
        let y = contentArea.y + 40;
        ctx.fillStyle = config.text;
        tips.forEach((tip, i) => {
          const cleanTip = tip.replace(/^\d+\.\s*/, '');
          ctx.font = `700 ${fontSize * 1.5}px system-ui`;
          ctx.fillStyle = config.accent;
          ctx.fillText(`${i + 1}`, contentArea.x, y);
          ctx.font = `400 ${fontSize}px system-ui`;
          ctx.fillStyle = config.text;
          const tipLines = wrapText(ctx, cleanTip, contentArea.width - 50, fontSize * 1.3);
          tipLines.forEach((line, li) => {
            ctx.fillText(line, contentArea.x + 40, y + li * fontSize * 1.3);
          });
          y += lineHeight + (tipLines.length - 1) * fontSize * 1.3;
        });
      } else if (template === 'stat') {
        const statFontSize = Math.min(width, height) * 0.15;
        const contextFontSize = Math.min(width, height) * 0.032;
        ctx.font = `800 ${statFontSize}px system-ui`;
        ctx.fillStyle = config.text;
        const statY = height / 2;
        ctx.fillText(content, contentArea.x, statY);
        if (secondaryContent) {
          ctx.font = `300 ${contextFontSize}px system-ui`;
          ctx.fillStyle = config.accent;
          const contextLines = wrapText(ctx, secondaryContent, contentArea.width, contextFontSize * 1.4);
          let y = statY + 30;
          contextLines.forEach(line => {
            ctx.fillText(line, contentArea.x, y);
            y += contextFontSize * 1.4;
          });
        }
      } else if (template === 'before-after') {
        const halfWidth = width / 2 - padding;
        const fontSize = Math.min(width, height) * 0.028;
        const labelSize = Math.min(width, height) * 0.02;
        // Before side
        ctx.fillStyle = config.accent;
        ctx.font = `600 ${labelSize}px system-ui`;
        ctx.fillText('BEFORE', contentArea.x, contentArea.y + 30);
        ctx.fillStyle = config.text;
        ctx.font = `300 ${fontSize}px system-ui`;
        const beforeLines = wrapText(ctx, content, halfWidth - 40, fontSize * 1.4);
        let y = contentArea.y + 70;
        beforeLines.forEach(line => {
          ctx.fillText(line, contentArea.x, y);
          y += fontSize * 1.4;
        });
        // Divider
        ctx.strokeStyle = config.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2, contentArea.y);
        ctx.lineTo(width / 2, height - padding - 40);
        ctx.stroke();
        // After side
        ctx.fillStyle = config.accent;
        ctx.font = `600 ${labelSize}px system-ui`;
        ctx.fillText('AFTER', width / 2 + 20, contentArea.y + 30);
        ctx.fillStyle = config.text;
        ctx.font = `300 ${fontSize}px system-ui`;
        const afterLines = wrapText(ctx, secondaryContent || '', halfWidth - 40, fontSize * 1.4);
        y = contentArea.y + 70;
        afterLines.forEach(line => {
          ctx.fillText(line, width / 2 + 20, y);
          y += fontSize * 1.4;
        });
      } else if (template === 'question') {
        const fontSize = Math.min(width, height) * 0.045;
        ctx.font = `600 ${fontSize}px system-ui`;
        const lines = wrapText(ctx, content, contentArea.width, fontSize * 1.3);
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
      }

      // Footer
      ctx.fillStyle = config.accent;
      ctx.font = '400 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('moonbootsconsultancy.net', padding, height - padding - 10);

      // Download
      const link = document.createElement('a');
      link.download = `moonboots-${template}-${platform}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const needsSecondaryContent = template === 'stat' || template === 'before-after';
  const aspectRatio = selectedPlatform.width / selectedPlatform.height;

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Template</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                template === t.id
                  ? 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-violet-500/50 ring-1 ring-violet-500/30'
                  : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <span className="text-xl mb-1 block">{t.icon}</span>
              <span className={`text-sm font-medium block ${template === t.id ? 'text-white' : 'text-slate-300'}`}>{t.name}</span>
              <span className="text-xs text-slate-500 line-clamp-1">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Platform Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Platform</label>
        <div className="flex flex-wrap gap-2">
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`px-4 py-2.5 rounded-lg border flex items-center gap-2 transition-all ${
                platform === p.id
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <span className="font-medium text-sm">{p.name}</span>
              <span className={`text-xs ${platform === p.id ? 'text-slate-600' : 'text-slate-500'}`}>{p.aspect}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Style</label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(tailwindStyles).map(st => (
            <button
              key={st}
              onClick={() => setStyle(st)}
              className={`px-4 py-2 text-sm rounded-lg border capitalize transition-all ${
                style === st
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent'
                  : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Content Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {template === 'stat' ? 'Statistic' : template === 'before-after' ? 'Before' : 'Content'}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none transition-all"
          rows={template === 'tips' ? 5 : 3}
        />
      </div>

      {/* Secondary Content Input */}
      {needsSecondaryContent && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {template === 'stat' ? 'Context' : 'After'}
          </label>
          <textarea
            value={secondaryContent}
            onChange={(e) => setSecondaryContent(e.target.value)}
            placeholder={getSecondaryPlaceholder()}
            className="w-full px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none transition-all"
            rows={2}
          />
        </div>
      )}

      {/* Preview */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Preview</label>
        <div
          className={`mx-auto ${s.bg} rounded-xl p-6 flex flex-col justify-between overflow-hidden`}
          style={{
            aspectRatio: `${aspectRatio}`,
            maxWidth: aspectRatio > 1 ? '100%' : '320px'
          }}
        >
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" className={style === 'light' ? 'text-slate-900' : 'text-white'}>
              <circle cx="12" cy="12" r="10" fill="currentColor"/>
              <circle cx="16" cy="10" r="8" fill={style === 'light' ? '#ffffff' : (config.gradient ? config.gradient[0] : '#0f172a')}/>
            </svg>
            <span className={`text-xs font-semibold tracking-tight ${s.text}`}>moonboots</span>
          </div>

          <div className="flex-1 flex items-center py-4">
            {template === 'quote' && (
              <p className={`text-base font-light leading-relaxed ${s.text}`}>{content || "Your quote here..."}</p>
            )}
            {template === 'tips' && (
              <div className="space-y-2 w-full">
                {(content || "1. First tip\n2. Second tip\n3. Third tip").split('\n').filter(t => t.trim()).slice(0, 4).map((tip, i) => (
                  <div key={i} className="flex gap-2">
                    <span className={`text-sm font-bold ${s.accent}`}>{i + 1}</span>
                    <span className={`text-xs ${s.text}`}>{tip.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                ))}
              </div>
            )}
            {template === 'stat' && (
              <div>
                <div className={`text-4xl font-extrabold ${s.text}`}>{content || "73%"}</div>
                <div className={`text-xs mt-1 ${s.accent}`}>{secondaryContent || "of companies fail..."}</div>
              </div>
            )}
            {template === 'before-after' && (
              <div className="flex w-full gap-3">
                <div className="flex-1">
                  <div className={`text-[10px] font-semibold mb-1 ${s.accent}`}>BEFORE</div>
                  <div className={`text-xs ${s.text}`}>{content || "Old way..."}</div>
                </div>
                <div className={`w-px ${style === 'light' ? 'bg-slate-300' : 'bg-slate-600'}`} />
                <div className="flex-1">
                  <div className={`text-[10px] font-semibold mb-1 ${s.accent}`}>AFTER</div>
                  <div className={`text-xs ${s.text}`}>{secondaryContent || "New way..."}</div>
                </div>
              </div>
            )}
            {template === 'question' && (
              <div className="relative w-full">
                <p className={`text-lg font-semibold leading-snug ${s.text}`}>{content || "What if you could...?"}</p>
                <span className={`absolute -right-2 -bottom-4 text-6xl font-black opacity-10 ${s.text}`}>?</span>
              </div>
            )}
          </div>

          <div className={`text-[10px] ${s.accent}`}>moonbootsconsultancy.net</div>
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={!content || downloading}
        className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl disabled:opacity-50 hover:from-violet-600 hover:to-fuchsia-600 flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/25"
      >
        {downloading ? (
          <>
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 border-2 border-white/30 rounded-full" />
              <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            Generating...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download {selectedPlatform.name} Image
          </>
        )}
      </button>
      <p className="text-xs text-slate-500 text-center">
        Downloads as {selectedPlatform.width}x{selectedPlatform.height} PNG ({selectedTemplate.name} for {selectedPlatform.name})
      </p>
    </div>
  );
};

// Settings
const SettingsPanel = ({ settings, onSettingsChange, saving }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showBufferKey, setShowBufferKey] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-4">Connected Accounts</h3>
        <div className="space-y-3">
          {[{ p: 'linkedin', label: 'LinkedIn', sub: 'Auto-post via Buffer' }, { p: 'instagram', label: 'Instagram', sub: 'Auto-post via Buffer' }, { p: 'x', label: 'X (Twitter)', sub: 'Manual posting only', manual: true }].map(({ p, label, sub, manual }) => (
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
        <h3 className="text-sm font-medium text-slate-300 mb-4">API Keys</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Claude API Key</label>
            <div className="relative">
              <input
                type={showClaudeKey ? 'text' : 'password'}
                value={localSettings.claudeApiKey || ''}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, claudeApiKey: e.target.value }))}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 pr-16 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowClaudeKey(!showClaudeKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                {showClaudeKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1">Get your key at console.anthropic.com</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Buffer Access Token</label>
            <div className="relative">
              <input
                type={showBufferKey ? 'text' : 'password'}
                value={localSettings.bufferAccessToken || ''}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, bufferAccessToken: e.target.value }))}
                placeholder="Enter your Buffer access token"
                className="w-full px-3 py-2 pr-16 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowBufferKey(!showBufferKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                {showBufferKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1">Get your token at buffer.com/developers</p>
          </div>
        </div>
      </div>
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <><div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />Saving...</> : 'Save Settings'}
        </button>
      )}
      {!hasChanges && localSettings.claudeApiKey && (
        <div className="p-3 bg-green-900/20 rounded-lg border border-green-800/30 text-xs text-green-400">
          Settings saved. Claude API is configured.
        </div>
      )}
    </div>
  );
};

// Performance Logging Modal
const PerformanceLogModal = ({ post, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    likes: 0,
    comments: 0,
    shares: 0,
    leads: 0,
    rating: 5,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...formData,
      post_id: post.id,
      content: post.content,
      platform: post.platform,
      pillar: post.pillar,
      posted_at: new Date().toISOString(),
      day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      hour: new Date().getHours(),
      length: post.content.length,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Log Performance</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">X</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <PlatformIcon platform={post.platform} className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">{post.pillar}</span>
            </div>
            <p className="text-sm text-slate-300 line-clamp-2">{post.content}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Likes</label>
              <input type="number" min="0" value={formData.likes} onChange={(e) => setFormData(p => ({ ...p, likes: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Comments</label>
              <input type="number" min="0" value={formData.comments} onChange={(e) => setFormData(p => ({ ...p, comments: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Shares</label>
              <input type="number" min="0" value={formData.shares} onChange={(e) => setFormData(p => ({ ...p, shares: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Leads</label>
              <input type="number" min="0" value={formData.leads} onChange={(e) => setFormData(p => ({ ...p, leads: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-2 block">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r} type="button" onClick={() => setFormData(p => ({ ...p, rating: r }))} className={`w-10 h-10 rounded-lg text-sm ${formData.rating >= r ? 'bg-yellow-500 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Notes (optional)</label>
            <textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="What worked well? What to improve?" className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none resize-none" rows={2} />
          </div>

          <button type="submit" disabled={saving} className="w-full py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />Saving...</> : 'Save Performance'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main App
export default function ContentStudio() {
  const [activeTab, setActiveTab] = useState('generate');
  const [posts, setPosts] = useState([]);
  const [performance, setPerformance] = useState(historicalPerformance);
  const [settings, setSettings] = useState({ claudeApiKey: '', bufferAccessToken: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [performanceLogPost, setPerformanceLogPost] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Lifted state from ContentGenerator - persists across tab switches
  const [generatorTopic, setGeneratorTopic] = useState('');
  const [generatorPillar, setGeneratorPillar] = useState('ai');
  const [generatorPlatforms, setGeneratorPlatforms] = useState({ linkedin: true, x: true, instagram: false });
  const [generatedContent, setGeneratedContent] = useState(null);
  const [useOptimalTiming, setUseOptimalTiming] = useState(true);
  const [instagramTemplate, setInstagramTemplate] = useState('quote');

  // Demo posts for when backend is not available
  const demoPosts = [
    { id: 'demo-1', content: "The best AI strategy isn't about the technology...", platform: 'linkedin', status: 'pending', pillar: 'AI Strategy', createdAt: '2025-01-12', scheduledFor: '2025-01-14 09:00' },
    { id: 'demo-2', content: "Web3 doesn't need more hype. It needs more builders.", platform: 'x', status: 'pending', pillar: 'Web3', createdAt: '2025-01-12', scheduledFor: null },
    { id: 'demo-3', content: "Athletes have millions of followers but don't own the relationship.", platform: 'instagram', status: 'approved', pillar: 'Community Building', createdAt: '2025-01-11', scheduledFor: '2025-01-13 12:00' },
  ];

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Load settings from localStorage first (fallback)
      const savedSettings = localStorage.getItem('moonboots_settings');
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings));
        } catch (e) {
          console.error('Error parsing saved settings:', e);
        }
      }

      // Check if backend is available
      const isBackendUp = await checkBackendAvailable();
      setBackendAvailable(isBackendUp);

      if (isBackendUp) {
        try {
          const [dbPosts, dbPerformance, dbSettings] = await Promise.all([
            api.getPosts(),
            api.getPerformance(),
            api.getSettings(),
          ]);

          if (dbPosts.length > 0) {
            setPosts(dbPosts.map(p => ({
              ...p,
              createdAt: p.created_at?.split('T')[0],
              scheduledFor: p.scheduled_for,
              suggestedTime: p.suggested_time,
            })));
          } else {
            setPosts(demoPosts);
          }

          if (dbPerformance.length > 0) {
            setPerformance(dbPerformance.map(p => ({
              ...p,
              postedAt: p.posted_at,
              dayOfWeek: p.day_of_week,
            })));
          }

          if (dbSettings) {
            setSettings({
              claudeApiKey: dbSettings.claude_api_key || '',
              bufferAccessToken: dbSettings.buffer_access_token || '',
            });
          }
        } catch (error) {
          console.error('Error loading from API:', error);
          setPosts(demoPosts);
        }
      } else {
        // No backend - use demo data
        setPosts(demoPosts);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  // Save settings
  const handleSettingsChange = useCallback(async (newSettings) => {
    setSaving(true);

    // Always save to localStorage
    localStorage.setItem('moonboots_settings', JSON.stringify(newSettings));

    // Also save to backend if available
    if (backendAvailable) {
      await api.saveSettings({
        claude_api_key: newSettings.claudeApiKey,
        buffer_access_token: newSettings.bufferAccessToken,
      });
    }

    setSettings(newSettings);
    setSaving(false);
  }, [backendAvailable]);

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

  const handleGenerate = useCallback(async (newPost) => {
    const post = {
      ...newPost,
      id: crypto.randomUUID?.() || Date.now().toString(),
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
      scheduledFor: null,
    };

    // Save to backend if available
    if (backendAvailable) {
      const savedPost = await api.createPost({
        content: post.content,
        platform: post.platform,
        pillar: post.pillar,
        status: 'pending',
        suggested_time: post.suggestedTime,
      });
      if (savedPost) {
        post.id = savedPost.id;
      }
    }

    setPosts(prev => [...prev, post]);
    setActiveTab('queue');
  }, [backendAvailable]);

  const handleApprove = useCallback(async (id) => {
    const scheduledFor = '2025-01-15 09:00';

    if (backendAvailable && !String(id).startsWith('demo-')) {
      await api.updatePost(id, { status: 'approved', scheduled_for: scheduledFor });
    }

    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', scheduledFor } : p));
  }, [backendAvailable]);

  const handleReject = useCallback(async (id) => {
    if (backendAvailable && !String(id).startsWith('demo-')) {
      await api.updatePost(id, { status: 'rejected' });
    }

    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
  }, [backendAvailable]);

  const handleMarkPublished = useCallback((post) => {
    setPerformanceLogPost(post);
  }, []);

  const handleSavePerformance = useCallback(async (perfData) => {
    // Save to backend if available
    if (backendAvailable) {
      await api.logPerformance({
        post_id: String(perfData.post_id).startsWith('demo-') ? null : perfData.post_id,
        content: perfData.content,
        platform: perfData.platform,
        pillar: perfData.pillar,
        posted_at: perfData.posted_at,
        day_of_week: perfData.day_of_week,
        hour: perfData.hour,
        length: perfData.length,
        likes: perfData.likes,
        comments: perfData.comments,
        shares: perfData.shares,
        leads: perfData.leads,
        rating: perfData.rating,
        notes: perfData.notes,
      });

      // Update post status to published
      if (!String(perfData.post_id).startsWith('demo-')) {
        await api.updatePost(perfData.post_id, { status: 'published' });
      }
    }

    // Add to local performance data
    setPerformance(prev => [{
      id: Date.now(),
      content: perfData.content,
      platform: perfData.platform,
      pillar: perfData.pillar,
      likes: perfData.likes,
      comments: perfData.comments,
      shares: perfData.shares,
      leads: perfData.leads,
      rating: perfData.rating,
      postedAt: perfData.posted_at,
      dayOfWeek: perfData.day_of_week,
      hour: perfData.hour,
      length: perfData.length,
    }, ...prev]);

    // Update post status
    setPosts(prev => prev.map(p => p.id === perfData.post_id ? { ...p, status: 'published' } : p));
  }, [backendAvailable]);

  const pendingCount = posts.filter(p => p.status === 'pending').length;
  const approvedCount = posts.filter(p => p.status === 'approved').length;

  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-fuchsia-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-slate-950/50">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block">js@moonbootsconsultancy.net</span>
            <div className="relative group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-medium shadow-lg shadow-blue-500/20 ring-2 ring-white/10 transition-all duration-300 group-hover:ring-white/20 group-hover:shadow-blue-500/30">
                JS
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-slate-950/30">
        <div className="max-w-6xl mx-auto px-8 flex gap-1 overflow-x-auto scrollbar-hide">
          <TabButton active={activeTab === 'generate'} onClick={() => setActiveTab('generate')}>Generate</TabButton>
          <TabButton active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} count={pendingCount}>Queue</TabButton>
          <TabButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')}>Calendar</TabButton>
          <TabButton active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')}>Graphics</TabButton>
          <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')}>Insights</TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>Settings</TabButton>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-8 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 w-10 h-10 border-2 border-transparent border-b-violet-500 rounded-full animate-spin animation-delay-150" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <span className="text-sm text-slate-500">Loading your content studio...</span>
          </div>
        ) : (
          <div className={activeTab === 'insights' ? '' : 'max-w-2xl'}>
            {activeTab === 'generate' && (
              <ContentGenerator
                onGenerate={handleGenerate}
                insights={insights}
                claudeApiKey={settings.claudeApiKey}
                topic={generatorTopic}
                setTopic={setGeneratorTopic}
                selectedPillar={generatorPillar}
                setSelectedPillar={setGeneratorPillar}
                platforms={generatorPlatforms}
                setPlatforms={setGeneratorPlatforms}
                generatedContent={generatedContent}
                setGeneratedContent={setGeneratedContent}
                useOptimalTiming={useOptimalTiming}
                setUseOptimalTiming={setUseOptimalTiming}
                instagramTemplate={instagramTemplate}
                setInstagramTemplate={setInstagramTemplate}
              />
            )}
            {activeTab === 'queue' && <ApprovalQueue posts={posts} onApprove={handleApprove} onReject={handleReject} onLogPerformance={handleMarkPublished} />}
            {activeTab === 'calendar' && <CalendarView posts={posts} />}
            {activeTab === 'graphics' && <GraphicsImageMaker />}
            {activeTab === 'insights' && <InsightsDashboard performance={performance} />}
            {activeTab === 'settings' && <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} saving={saving} />}
          </div>
        )}
      </main>

      {performanceLogPost && (
        <PerformanceLogModal
          post={performanceLogPost}
          onClose={() => setPerformanceLogPost(null)}
          onSave={handleSavePerformance}
        />
      )}

      {!backendAvailable && (
        <div className="fixed bottom-6 right-6 p-4 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-amber-500/20 text-sm text-amber-400 max-w-xs shadow-xl shadow-black/20">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚡</span>
            <div>
              <p className="font-medium">Demo Mode</p>
              <p className="text-xs text-slate-400 mt-1">Backend not connected. Data will not persist.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
