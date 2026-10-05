// Brand rules shared by the server and the browser.
// Checks only warn; they never change the text. UTM tags are the one automatic edit.

// ============ TOUCHLINE CONTENT CHECKS ============

const TOUCHLINE_CHECKS = [
  {
    id: 'dash',
    pattern: /[—–]|\s-{1,2}\s/,
    message: 'Contains a dash (em dash, en dash or spaced hyphen). Use a full stop, comma or colon.',
  },
  {
    id: 'only-first',
    // "the first half", "the first team" and similar football phrases are fine
    pattern: /\b(?:the|our)\s+(?:only|first)\b(?!\s+(?:half|team|whistle|touch|time|step|session|game|match|goal|kick|week|weekend|month|season|day|minute|minutes|few|thing|choice|training|xi|leg|round|tackle|pass|save)\b)/i,
    message: 'Says "the only" or "the first". Touchline never claims to be the only or the first.',
  },
  {
    id: 'endorsement',
    pattern: /charter\s+standard|england\s+football\s+accredited|\bFA[\s-]+(?:accredited|approved|endorsed)\b|(?:endorsed|approved|accredited)\s+by\s+the\s+FA\b/i,
    message: 'Mentions FA Charter Standard or England Football Accredited endorsement. Touchline has no such endorsement.',
  },
  {
    id: 'atlas',
    pattern: /\batlas\b/i,
    message: 'Mentions Atlas. Never mention Atlas player tracking.',
  },
  {
    id: 'native-app',
    pattern: /\bnative\s+app\b|\bapp\s+store\b|\bgoogle\s+play\b|\b(?:ios|android|iphone)\s+app\b|\bdownload\s+(?:the|our)\s+app\b/i,
    message: 'Suggests a native or app store app. Touchline is not a native app.',
  },
  {
    id: 'time-saving',
    pattern: /\bsav(?:e|es|ed|ing)\b[^.!?\n]{0,40}\b(?:\d+\s*(?:hours?|hrs?|minutes?|mins?)|hours|time)\b|\b\d+\s*(?:hours?|hrs?|minutes?|mins?)\b[^.!?\n]{0,30}\b(?:saved|back|a week|every week)\b/i,
    message: 'Claims a time saving. Only use time savings we can prove.',
  },
];

// Warnings for a post in a workspace. Returns [{ id, message }].
export function checkContent(workspaceSlug, text) {
  if (workspaceSlug !== 'touchline' || !text) return [];
  return TOUCHLINE_CHECKS.filter(check => check.pattern.test(text)).map(({ id, message }) => ({ id, message }));
}

// ============ UTM TAGS ============

export function pillarSlug(pillar, pillars = []) {
  if (!pillar) return 'general';
  const known = pillars.find(p => p.id === pillar || p.name?.toLowerCase() === String(pillar).toLowerCase());
  const value = known ? known.id : String(pillar);
  return value.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
}

const REGISTER_LINK = /(https?:\/\/)?(www\.)?touchline\.xyz\/register\b([^\s<>"')\]]*)/gi;

// Add UTM tags to touchline.xyz/register links that have none. Existing UTM tags are never changed.
export function addUtmTags(text, { platform, pillar, pillars = [] } = {}) {
  if (!text) return text;
  return text.replace(REGISTER_LINK, (match, protocol, www, rest) => {
    const trailing = (rest.match(/[.,!?;:]+$/) || [''])[0];
    const tail = trailing ? rest.slice(0, -trailing.length) : rest;
    if (/[?&]utm_/i.test(tail)) return match;

    const hashIndex = tail.indexOf('#');
    const beforeHash = hashIndex === -1 ? tail : tail.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : tail.slice(hashIndex);
    const params = new URLSearchParams({
      utm_source: platform || 'social',
      utm_medium: 'organic_social',
      utm_campaign: pillarSlug(pillar, pillars),
    }).toString();
    const separator = beforeHash.includes('?') ? (beforeHash.endsWith('?') || beforeHash.endsWith('&') ? '' : '&') : '?';

    return `${protocol || 'https://'}${www || ''}touchline.xyz/register${beforeHash}${separator}${params}${hash}${trailing}`;
  });
}

// What gets published for a post in a workspace
export function prepareForPublishing(workspace, post) {
  if (workspace?.slug !== 'touchline') return post.content;
  return addUtmTags(post.content, { platform: post.platform, pillar: post.pillar, pillars: workspace.pillars || [] });
}

// ============ TOUCHLINE MARK ============

export const TOUCHLINE_COLOURS = { navy: '#08111F', green: '#00FF85', white: '#FFFFFF' };

// The Touchline mark (viewBox 0 0 64 40), coloured with `colour`
export function touchlineMarkSvg(colour = TOUCHLINE_COLOURS.green) {
  return `<g fill="none" stroke="${colour}" stroke-linecap="round"><path d="M16 32 A16 16 0 0 1 48 32" stroke-width="3.6"/><line x1="6" y1="32" x2="58" y2="32" stroke-width="3.6"/><circle cx="32" cy="32" r="5.6" stroke-width="1.2" opacity="0.32"/></g><circle cx="32" cy="32" r="3.4" fill="${colour}"/>`;
}
