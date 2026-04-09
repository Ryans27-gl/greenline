const { corsHeaders, checkRateLimit, rateLimitResponse, requireEnv, sanitizeString, withTimeout } = require('./_shared');

const MAX_BODY_BYTES = 5 * 1024; // 5KB

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!checkRateLimit(event)) return rateLimitResponse(event);

  // Body size limit
  if (event.body && Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: 'Request body too large' }) };
  }

  try {
    requireEnv('ANTHROPIC_API_KEY');
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let prompt;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = sanitizeString(body.prompt, 4000);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!prompt || prompt.length < 10) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No prompt provided' }) };
  }

  try {
    const res = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    }), 15000);

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status >= 500 ? 502 : 400, headers, body: JSON.stringify({ error: 'AI service error' }) };
    }

    const text = data.content?.[0]?.text || 'Could not generate explanation.';
    return { statusCode: 200, headers, body: JSON.stringify({ text }) };
  } catch {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to reach AI service' }) };
  }
};
