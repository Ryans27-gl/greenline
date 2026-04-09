const { getStore } = require('@netlify/blobs');
const { corsHeaders, checkRateLimit, rateLimitResponse, requireEnv, isValidEmail, sanitizeString } = require('./_shared');

const MAX_BODY_BYTES = 2 * 1024;

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!checkRateLimit(event)) return rateLimitResponse(event);

  if (event.body && Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: 'Request too large' }) };
  }

  let email, source;
  try {
    const body = JSON.parse(event.body || '{}');
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    source = sanitizeString(body.source || 'unknown', 50);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!isValidEmail(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  try {
    requireEnv('NETLIFY_SITE_ID', 'NETLIFY_API_TOKEN');
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    const store = getStore({
      name: 'waitlist',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN,
    });

    const existing = await store.get(email, { type: 'json' });
    if (existing) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: "You're already on the list!" }) };
    }

    const entry = {
      email,
      timestamp: new Date().toISOString(),
      userAgent: sanitizeString(event.headers?.['user-agent'] || '', 300),
      source,
    };

    await store.setJSON(email, entry);

    return { statusCode: 200, headers, body: JSON.stringify({ message: "You're on the list! We'll notify you at launch." }) };
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save. Please try again.' }) };
  }
};
