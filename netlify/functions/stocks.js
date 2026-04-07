const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

exports.handler = async (event) => {
  const symbols = (event.queryStringParameters?.symbols || '').split(',').filter(Boolean).slice(0, 10);
  
  if (symbols.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No symbols provided' }) };
  }

  const results = {};
  const now = Date.now();
  const toFetch = symbols.filter(s => !cache[s] || now - cache[s].ts >= CACHE_TTL);

  if (toFetch.length > 0) {
    try {
      // Use Yahoo Finance via a public proxy
      const query = toFetch.join(',');
      const res = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${query}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const data = await res.json();
      const quotes = data?.quoteResponse?.result || [];
      
      for (const q of quotes) {
        const stockData = {
          price: q.regularMarketPrice,
          change: q.regularMarketChangePercent,
          vol: q.regularMarketVolume
        };
        cache[q.symbol] = { data: stockData, ts: now };
        results[q.symbol] = stockData;
      }
    } catch(e) {
      console.log('Yahoo Finance error:', e.message);
    }
  }

  // Add cached results
  for (const sym of symbols) {
    if (!results[sym] && cache[sym]) {
      results[sym] = cache[sym].data;
    }
  }

  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify(results)
  };
};
