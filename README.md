# Greenline News

Live financial news + real-time stock data.

## Security

Run `npm audit` periodically to check for vulnerable dependencies:

```
npm audit
npm audit fix
```

Required environment variables (set in Netlify dashboard):

- `ANTHROPIC_API_KEY` — Claude API key for /explain function
- `FINNHUB_KEY` — Finnhub API key for /stocks function
- `NETLIFY_SITE_ID` — Netlify site ID for Blobs storage
- `NETLIFY_API_TOKEN` — Netlify personal access token for Blobs
- `WAITLIST_ADMIN_KEY` — Secret key for /waitlist-admin endpoint
