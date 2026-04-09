const { getStore } = require('@netlify/blobs');
const { corsHeaders, checkRateLimit, rateLimitResponse, requireEnv, timingSafeEqual } = require('./_shared');

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!checkRateLimit(event)) return rateLimitResponse(event);

  try {
    requireEnv('WAITLIST_ADMIN_KEY', 'NETLIFY_SITE_ID', 'NETLIFY_API_TOKEN');
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const secret = event.queryStringParameters?.key || '';

  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(secret, process.env.WAITLIST_ADMIN_KEY)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore({
      name: 'waitlist',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN,
    });
    const { blobs } = await store.list();

    const entries = [];
    for (const blob of blobs) {
      const data = await store.get(blob.key, { type: 'json' });
      if (data) entries.push(data);
    }

    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ total: entries.length, emails: entries }),
    };
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
