const { corsHeaders, checkRateLimit, rateLimitResponse, withTimeout } = require('./_shared');

const VALID_CATS = ['all', 'business', 'technology', 'energy', 'health', 'economy', 'markets'];

exports.handler = async (event) => {
  const headers = { ...corsHeaders(event), 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=900, max-age=300' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!checkRateLimit(event)) return rateLimitResponse(event);

  const rawCat = event.queryStringParameters?.cat || 'all';
  const cat = VALID_CATS.includes(rawCat) ? rawCat : 'all';

  const FEEDS = {
    all: [
      'https://www.cnbc.com/id/100003114/device/rss/rss.html',
      'https://seekingalpha.com/market_currents.xml',
      'https://www.benzinga.com/news/feed',
    ],
    business: [
      'https://feeds.marketwatch.com/marketwatch/topstories',
      'https://seekingalpha.com/feed.xml',
      'https://www.benzinga.com/news/earnings/feed',
    ],
    technology: [
      'https://www.cnbc.com/id/19854910/device/rss/rss.html',
      'https://seekingalpha.com/tag/long-ideas.xml',
      'https://www.benzinga.com/tech/feed',
    ],
    energy: [
      'https://www.cnbc.com/id/19836768/device/rss/rss.html',
      'https://seekingalpha.com/tag/etf-portfolio-strategy.xml',
    ],
    health: [
      'https://www.cnbc.com/id/10000108/device/rss/rss.html',
      'https://seekingalpha.com/feed.xml',
    ],
    economy: [
      'https://www.cnbc.com/id/20910258/device/rss/rss.html',
      'https://seekingalpha.com/tag/wall-st-breakfast.xml',
      'https://feeds.marketwatch.com/marketwatch/topstories',
    ],
    markets: [
      'https://seekingalpha.com/market_currents.xml',
      'https://www.benzinga.com/markets/feed',
      'https://www.benzinga.com/trading-ideas/feed',
      'https://feeds.marketwatch.com/marketwatch/topstories',
    ],
  };

  const feeds = FEEDS[cat] || FEEDS.all;
  const articles = [];
  const errors = [];

  // Fetch feeds sequentially in pairs to avoid rss2json rate limits
  for (let i = 0; i < feeds.length; i += 2) {
    const batch = feeds.slice(i, i + 2);
    const results = await Promise.allSettled(batch.map(async (feedUrl) => {
      const res = await withTimeout(fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`), 10000);
      if (!res.ok) throw new Error(`${feedUrl} returned ${res.status}`);
      const data = await res.json();
      if (data.status !== 'ok' || !data.items) throw new Error(`${feedUrl}: ${data.message || 'no items'}`);
      const sourceName = data.feed?.title || 'News';
      return data.items.map(item => ({
        title: item.title,
        description: item.description ? item.description.replace(/<[^>]*>/g, '').slice(0, 250) : '',
        url: item.link,
        publishedAt: item.pubDate || new Date().toISOString(),
        source: { name: sourceName },
      }));
    }));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        articles.push(...result.value);
      } else {
        errors.push(result.reason.message);
      }
    }
  }

  // Deduplicate by title
  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by newest first and filter to last 72 hours
  const now = Date.now();
  const fresh = unique
    .filter(a => (now - new Date(a.publishedAt).getTime()) < 72 * 3600 * 1000)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 10);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      articles: fresh.length >= 3 ? fresh : unique.slice(0, 10),
      feedErrors: errors.length > 0 ? errors : undefined,
    })
  };
};
