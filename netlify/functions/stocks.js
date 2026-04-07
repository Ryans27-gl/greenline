// Using Finnhub free tier - 60 calls/minute, no rate limit issues
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

exports.handler = async (event) => {
  const symbols = (event.queryStringParameters?.symbols || '').split(',').filter(Boolean).slice(0, 8);
  
  if (symbols.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No symbols' }) };
  }

  const results = {};
  const now = Date.now();
  const toFetch = symbols.filter(s => !cache[s] || now - cache[s].ts >= CACHE_TTL);

  // Fetch each symbol (Finnhub free tier supports this well)
  await Promise.all(toFetch.map(async (sym) => {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
      const d = await res.json();
      if (d.c && d.c > 0) {
        const stockData = {
          price: d.c,
          change: d.dp,
          open: d.o,
          high: d.h,
          low: d.l,
          prev: d.pc
        };
        cache[sym] = { data: stockData, ts: now };
        results[sym] = stockData;
      }
    } catch(e) {}
  }));

  // Add cached
  for (const sym of symbols) {
    if (!results[sym] && cache[sym]) results[sym] = cache[sym].data;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    body: JSON.stringify(results)
  };
};
