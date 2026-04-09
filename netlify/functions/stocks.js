const { corsHeaders, checkRateLimit, rateLimitResponse, requireEnv, isValidTicker, withTimeout } = require('./_shared');

const quoteCache = {};
const profileCache = {};
const CACHE_TTL = 5 * 60 * 1000;
const PROFILE_TTL = 24 * 60 * 60 * 1000;

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=300, max-age=60' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!checkRateLimit(event)) return rateLimitResponse(event);

  try {
    requireEnv('FINNHUB_KEY');
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const FINNHUB_KEY = process.env.FINNHUB_KEY;
  const rawSymbols = (event.queryStringParameters?.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const symbols = rawSymbols.filter(isValidTicker).slice(0, 8);
  const includeProfile = event.queryStringParameters?.profile === '1';

  if (symbols.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid symbols' }) };
  }

  const results = {};
  const now = Date.now();

  const quotesToFetch = symbols.filter(s => !quoteCache[s] || now - quoteCache[s].ts >= CACHE_TTL);

  await Promise.all(quotesToFetch.map(async (sym) => {
    try {
      const res = await withTimeout(
        fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_KEY}`),
        8000
      );
      const d = await res.json();
      if (d.c && d.c > 0) {
        quoteCache[sym] = {
          data: { price: d.c, change: d.dp, open: d.o, high: d.h, low: d.l, prev: d.pc },
          ts: now,
        };
      }
    } catch {}
  }));

  if (includeProfile) {
    const profilesToFetch = symbols.filter(s => !profileCache[s] || now - profileCache[s].ts >= PROFILE_TTL);

    await Promise.all(profilesToFetch.map(async (sym) => {
      try {
        const res = await withTimeout(
          fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_KEY}`),
          8000
        );
        const d = await res.json();
        if (d.name) {
          profileCache[sym] = {
            data: {
              name: d.name,
              sector: d.finnhubIndustry || '',
              marketCap: d.marketCapitalization || null,
              logo: d.logo || '',
              exchange: d.exchange || '',
              country: d.country || '',
            },
            ts: now,
          };
        }
      } catch {}
    }));
  }

  for (const sym of symbols) {
    const quote = quoteCache[sym]?.data;
    if (quote) {
      results[sym] = { ...quote };
      if (includeProfile && profileCache[sym]?.data) {
        results[sym].profile = profileCache[sym].data;
      }
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify(results) };
};
