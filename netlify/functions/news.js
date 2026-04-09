// Simple in-memory cache: { key: { data, expires } }
const cache = {};

async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Greenline/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const head = html.slice(0, 50000);

    const ogMatch = head.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];

    const twMatch = head.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  console.log('news.js called, cat:', event.queryStringParameters?.cat || 'all');

  const cat = event.queryStringParameters?.cat || 'all';

  // Check cache (5 minute TTL)
  const cacheKey = `feed_${cat}`;
  const cached = cache[cacheKey];
  if (cached && cached.expires > Date.now()) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=900, max-age=300' },
      body: cached.data,
    };
  }

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

  for (let i = 0; i < feeds.length; i += 2) {
    const batch = feeds.slice(i, i + 2);
    const results = await Promise.allSettled(batch.map(async (feedUrl) => {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
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
        thumbnail: item.thumbnail || null,
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

  const finalArticles = fresh.length >= 3 ? fresh : unique.slice(0, 10);

  // Try to fetch OG images — completely optional, must not block articles
  try {
    await Promise.allSettled(finalArticles.map(async (article) => {
      if (article.thumbnail) return;
      if (!article.url || article.url === '#') return;
      const img = await fetchOgImage(article.url);
      if (img) article.thumbnail = img;
    }));
  } catch (e) {
    console.log('OG scraping failed, continuing without thumbnails:', e.message);
  }

  const body = JSON.stringify({
    articles: finalArticles,
    feedErrors: errors.length > 0 ? errors : undefined,
  });

  // Cache for 5 minutes
  cache[cacheKey] = { data: body, expires: Date.now() + 5 * 60 * 1000 };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=900, max-age=300' },
    body,
  };
};
