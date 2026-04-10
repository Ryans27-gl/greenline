# Greenline News

> Live financial news + real-time stock data for everyday investors.

[![Site](https://img.shields.io/badge/site-greenlinenews.com-6a9e52)](https://greenlinenews.com)
[![License](https://img.shields.io/badge/license-proprietary-111a0f)](#)

**Greenline News** is a beginner-friendly live market news platform that combines real-time stock prices, AI-powered article explanations, and personalized investing guides. Built to help everyday people stay informed without drowning in financial jargon.

## Features

- **Live news feed** — aggregated from CNBC, Seeking Alpha, MarketWatch, Benzinga
- **Real-time stock prices** — 15+ major tickers with live % change
- **AI article explanations** — "Explain this" button uses Claude to break down any headline in plain English
- **Personal watchlist** — track any stock with mini-charts
- **Broker quiz** (`/learn.html`) — matches you with Robinhood, Public, or Webull based on your goals
- **Crypto guide** (`/crypto-learn.html`) — beginner education + platform quiz (Coinbase, Robinhood, ChangeNOW)
- **Crash courses** — step-by-step walkthroughs for each broker and crypto platform
- **Clean dark UI** — no banners, no jargon, no paywall

## Stack

- Vanilla HTML/CSS/JS — no framework bloat
- **Netlify** hosting + Netlify Functions for API proxy
- **Claude API** (Anthropic) for AI explanations
- **Finnhub** for real-time stock data
- **rss2json** for RSS aggregation
- **Netlify Blobs** for waitlist storage

## Press & Brand Assets

See the [press kit](https://greenlinenews.com/press.html) for logos, colors, and media inquiries.

## Environment Variables

Required for local dev and production (set in Netlify dashboard):

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key for `/explain` function |
| `FINNHUB_KEY` | Finnhub stock API key |
| `NETLIFY_SITE_ID` | Netlify site ID for Blobs storage |
| `NETLIFY_API_TOKEN` | Netlify personal access token |
| `WAITLIST_ADMIN_KEY` | Secret key for `/waitlist-admin` endpoint |

## Security

Run `npm audit` periodically to check for vulnerable dependencies. Security headers, rate limiting, and input validation are configured in `netlify.toml` and `netlify/functions/_shared.js`.

## Contact

- **Press**: [press@greenlinenews.com](mailto:press@greenlinenews.com)
- **Legal**: [legal@greenlinenews.com](mailto:legal@greenlinenews.com)
- **Site**: [greenlinenews.com](https://greenlinenews.com)
