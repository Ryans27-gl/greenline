exports.handler = async (event) => {
  const cat = event.queryStringParameters?.cat || 'all';

  const FEEDS = {
    all: ['https://feeds.reuters.com/reuters/businessNews', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'],
    business: ['https://feeds.reuters.com/reuters/businessNews', 'https://feeds.marketwatch.com/marketwatch/topstories'],
    technology: ['https://feeds.reuters.com/reuters/technologyNews', 'https://www.cnbc.com/id/19854910/device/rss/rss.html'],
    energy: ['https://feeds.reuters.com/reuters/energy', 'https://www.cnbc.com/id/19836768/device/rss/rss.html'],
    health: ['https://feeds.reuters.com/reuters/health', 'https://www.cnbc.com/id/10000108/device/rss/rss.html'],
    economy: ['https://feeds.reuters.com/reuters/economy', 'https://www.cnbc.com/id/20910258/device/rss/rss.html'],
  };

  const feeds = FEEDS[cat] || FEEDS.all;
  const articles = [];

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=10`);
      const data = await res.json();
      if (data.status === 'ok' && data.items) {
        const sourceName = data.feed?.title || 'News';
        data.items.forEach(item => {
          articles.push({
            title: item.title,
            description: item.description ? item.description.replace(/<[^>]*>/g, '').slice(0, 250) : '',
            url: item.link,
            publishedAt: item.pubDate || new Date().toISOString(),
            source: { name: sourceName }
          });
        });
      }
    } catch(e) {}
  }

  // Sort by newest first and filter to last 48 hours
  const now = Date.now();
  const fresh = articles
    .filter(a => (now - new Date(a.publishedAt).getTime()) < 48 * 3600 * 1000)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 6);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articles: fresh.length >= 3 ? fresh : articles.slice(0, 6) })
  };
};
