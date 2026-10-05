import crypto from 'crypto';

// ============ ADMIN LOGIN (one shared password from ADMIN_PASSWORD) ============

const SESSION_COOKIE = 'cs_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Login attempts allowed per IP in each window before we slow them down
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map();

export function adminPasswordSet() {
  return !!process.env.ADMIN_PASSWORD;
}

// Constant-time string comparison (hashing first makes the lengths equal)
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Sessions are signed with a key derived from ADMIN_PASSWORD,
// so changing the password logs everyone out.
function signingKey() {
  return crypto.createHash('sha256').update(`content-studio-session:${process.env.ADMIN_PASSWORD}`).digest();
}

function sign(value) {
  return crypto.createHmac('sha256', signingKey()).update(value).digest('base64url');
}

function createSessionToken() {
  const expires = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expires}.${sign(expires)}`;
}

function isValidSessionToken(token) {
  if (!token || !adminPasswordSet()) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires))) return false;
  return Number(expires) > Date.now();
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function setSessionCookie(req, res, token, maxAge) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (req.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function isAdmin(req) {
  return isValidSessionToken(readCookie(req, SESSION_COOKIE));
}

export function requireAdmin(req, res, next) {
  if (!adminPasswordSet()) {
    return res.status(503).json({
      error: 'ADMIN_PASSWORD is not set on the server. Add it in Railway > Variables.',
      code: 'admin_password_missing',
    });
  }
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Please log in.', code: 'login_required' });
  }
  next();
}

export function handleLogin(req, res) {
  if (!adminPasswordSet()) {
    return res.status(503).json({
      error: 'ADMIN_PASSWORD is not set on the server. Add it in Railway > Variables.',
      code: 'admin_password_missing',
    });
  }

  const ip = req.ip || 'unknown';
  const now = Date.now();
  const record = loginFailures.get(ip);
  if (record && record.resetAt > now && record.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    if (loginFailures.size > 5000) {
      for (const [key, value] of loginFailures) {
        if (value.resetAt <= now) loginFailures.delete(key);
      }
    }
    const fresh = !record || record.resetAt <= now;
    loginFailures.set(ip, {
      count: fresh ? 1 : record.count + 1,
      resetAt: fresh ? now + LOGIN_WINDOW_MS : record.resetAt,
    });
    return res.status(401).json({ error: 'Wrong password.' });
  }

  loginFailures.delete(ip);
  setSessionCookie(req, res, createSessionToken(), SESSION_MAX_AGE_SECONDS);
  res.json({ authenticated: true });
}

export function handleLogout(req, res) {
  setSessionCookie(req, res, '', 0);
  res.json({ authenticated: false });
}

export function handleMe(req, res) {
  res.json({ authenticated: isAdmin(req), passwordSet: adminPasswordSet() });
}

// ============ WORKSPACE API KEYS (Bearer, for Touchline HQ / Marcus) ============

// Railway variable holding a workspace's key, e.g. TOUCHLINE_API_KEY
export function envKeyName(workspace) {
  return `${String(workspace.slug || workspace.id).toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
}

export function envKeyFor(workspace) {
  return process.env[envKeyName(workspace)] || null;
}

export function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}
