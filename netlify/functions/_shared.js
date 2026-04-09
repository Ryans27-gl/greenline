// Shared security helpers for all Netlify functions
const crypto = require('crypto');

const ALLOWED_ORIGINS = [
  'https://greenlinenews.com',
  'https://www.greenlinenews.com',
  'http://localhost:8888',
  'http://localhost:3000',
];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://greenlinenews.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Simple in-memory rate limiter (per-instance)
const rateBuckets = new Map();
const RATE_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT = 60;

function getClientIP(event) {
  return (
    event.headers?.['x-nf-client-connection-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    'unknown'
  );
}

function checkRateLimit(event) {
  const ip = getClientIP(event);
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, reset: now + RATE_WINDOW };

  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + RATE_WINDOW;
  }

  bucket.count++;
  rateBuckets.set(ip, bucket);

  // Cleanup old buckets occasionally
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets.entries()) {
      if (now > v.reset) rateBuckets.delete(k);
    }
  }

  return bucket.count <= RATE_LIMIT;
}

function rateLimitResponse(event) {
  return {
    statusCode: 429,
    headers: { ...corsHeaders(event), 'Content-Type': 'application/json', 'Retry-After': '60' },
    body: JSON.stringify({ error: 'Too many requests. Please try again in a minute.' }),
  };
}

// Timing-safe string compare (prevents timing attacks)
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Still do a comparison to avoid early-return timing leak
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

// Validate environment variables — throw early if missing
function requireEnv(...keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

// Simple input sanitization helpers
function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen).trim();
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidTicker(sym) {
  if (typeof sym !== 'string') return false;
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym);
}

// Wrap a promise with a timeout
function withTimeout(promise, ms, errMsg = 'Request timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms)),
  ]);
}

module.exports = {
  corsHeaders,
  checkRateLimit,
  rateLimitResponse,
  timingSafeEqual,
  requireEnv,
  sanitizeString,
  isValidEmail,
  isValidTicker,
  withTimeout,
  getClientIP,
};
