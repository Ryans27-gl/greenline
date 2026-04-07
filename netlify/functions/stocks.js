const FINNHUB_KEY = process.env.FINNHUB_KEY;
const quoteCache = {};
const profileCache = {};
const CACHE_TTL = 5 * 60 * 1000;
const PROFILE_TTL = 24 * 60 * 60 * 1000; // profiles rarely change, cache 24h

exports.handler = async (event) => {
  const symbols = (event.queryStringParameters?.symbols || '').split(',').filter(Boolean).slice(0, 8);
  const includeProfile = event.queryStringParameters?.profile === '1';

  if (symbols.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No symbols' }) };
  }

  const results = {};
  const now = Date.now();

  // Fetch quotes
  const quotesToFetch = symbols.filter(s => !quoteCache[s] || now - quoteCache[s].ts >= CACHE_TTL);

  await Promise.all(quotesToFetch.map(async (sym) => {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
      const d = await res.json();
      if (d.c && d.c > 0) {
        quoteCache[sym] = {
          data: { price: d.c, change: d.dp, open: d.o, high: d.h, low: d.l, prev: d.pc },
          ts: now
        };
      }
    } catch(e) {}
  }));

  // Fetch profiles if requested
  if (includeProfile) {
    const profilesToFetch = symbols.filter(s => !profileCache[s] || now - profileCache[s].ts >= PROFILE_TTL);

    await Promise.all(profilesToFetch.map(async (sym) => {
      try {
        const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FINNHUB_KEY}`);
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
            ts: now
          };
        }
      } catch(e) {}
    }));
  }

  // Build results
  for (const sym of symbols) {
    const quote = quoteCache[sym]?.data;
    if (quote) {
      results[sym] = { ...quote };
      if (includeProfile && profileCache[sym]?.data) {
        results[sym].profile = profileCache[sym].data;
      }
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=300, max-age=60' },
    body: JSON.stringify(results)
  };
};
