const POLY_KEY = '5yZz_lFOat0OcFGjE_d41p1WFAKGh03v';
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

exports.handler = async (event) => {
  const symbols = (event.queryStringParameters?.symbols || '').split(',').filter(Boolean).slice(0, 10);
  
  if (symbols.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No symbols provided' }) };
  }

  const results = {};
  const toFetch = [];

  // Check cache first
  const now = Date.now();
  for (const sym of symbols) {
    if (cache[sym] && now - cache[sym].ts < CACHE_TTL) {
      results[sym] = cache[sym].data;
    } else {
      toFetch.push(sym);
    }
  }

  // Fetch uncached symbols with delay to avoid rate limits
  for (let i = 0; i < toFetch.length; i++) {
    const sym = toFetch[i];
    if (i > 0) await new Promise(r => setTimeout(r, 300)); // 300ms delay between requests
    
    try {
      const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${sym}/prev?adjusted=true&apiKey=${POLY_KEY}`);
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const cur = data.results[0];
        const change = (cur.c - cur.o) / cur.o * 100;
        const stockData = {
          price: cur.c,
          change,
          open: cur.o,
          high: cur.h,
          low: cur.l,
          vol: cur.v
        };
        cache[sym] = { data: stockData, ts: now };
        results[sym] = stockData;
      }
    } catch(e) {
      // Skip failed symbols
    }
  }

  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // Cache for 5 min at CDN level too
    },
    body: JSON.stringify(results)
  };
};
