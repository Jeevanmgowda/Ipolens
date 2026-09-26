# IPOLENS — Institutional IPO Discovery & Live Market Platform

IPOLENS is a fintech web platform for primary market IPO discovery, multi-PAN family bidding, allotment tracking, Demat portfolio management, and real-time live market telemetry.

---

## Live Market Feature

The **Live Market** engine provides live Indian IPO market subscription feeds, real-time Grey Market Premium (GMP) trend curves, and live listed-market candlestick charts.

### 1. Architecture

```text
External Market API (Upstox Market Data Feed V3 / NSE Scraper)
                             │
                             ▼
              Next.js 16 / Node.js Backend
                             │
    ┌────────────────────────┴────────────────────────┐
    ▼                                                 ▼
Provider Layer (UpstoxProvider / MockProvider)    In-Memory / Redis Cache
    │                                                 │
    └────────────────────────┬────────────────────────┘
                             │
            Server-Sent Events (SSE) / WebSocket
                             │
                             ▼
            React Real-Time Live Charts & Telemetry
```

- **Clean Provider Abstraction**:
  - `MarketDataProvider` interface implemented by `UpstoxProvider` and `MockMarketProvider`.
  - `IPODataProvider` interface implemented by `NSEIPOProvider` and `MockIPOProvider`.
- **Zero Secrets on Client**: All API keys, secrets, and bearer tokens reside exclusively on the server in environment variables.
- **Resilient Fallback**: If Upstox or external APIs disconnect or encounter rate-limits, the engine falls back gracefully without crashing.

---

### 2. API Providers

- **Upstox API (Market Data Feed V3)**: Preferred real-time market data provider for LTP, OHLC candles, and market depth.
- **National Stock Exchange (NSE India)**: Official primary market order book, category subscriptions, and bidding distribution curves.
- **Mock Provider (Free Development)**: Built-in deterministic simulated market generator conforming to Indian equity market microstructures.

---

### 3. Environment Variables

Create a `.env.local` file by copying `.env.example`:

```bash
cp .env.example .env.local
```

Configured variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `USE_MOCK_MARKET_DATA` | Free-development mode toggle | `true` |
| `UPSTOX_CLIENT_ID` | Upstox Developer API Key (Client ID) | (Optional) |
| `UPSTOX_CLIENT_SECRET` | Upstox App Secret | (Optional) |
| `UPSTOX_ACCESS_TOKEN` | OAuth2 Bearer Access Token | (Optional) |
| `IPO_API_KEY` | External primary market API key | (Optional) |
| `GMP_API_KEY` | Grey market premium aggregator key | (Optional) |
| `REDIS_URL` | Redis URL for quotation caching | (Optional) |
| `CLIENT_URL` | Frontend origin for CORS verification | `http://localhost:3000` |

---

### 4. How to Obtain API Credentials

#### Upstox Market Data Feed V3
1. Register or log in to the **[Upstox Developer Console](https://developer.upstox.com/)**.
2. Navigate to **Apps** and click **New App**.
3. Set your Redirect URI to `http://localhost:3000/api/auth/callback/upstox`.
4. Copy your **API Key** into `UPSTOX_CLIENT_ID` and **API Secret** into `UPSTOX_CLIENT_SECRET`.
5. Authenticate via OAuth2 to generate your daily `UPSTOX_ACCESS_TOKEN`.

#### Gemini AI (DRHP Prospectus Analysis)
1. Visit **[Google AI Studio](https://aistudio.google.com/)**.
2. Create an API Key and place it in `GEMINI_API_KEY`.

---

### 5. How to Run in Mock Mode (Free Development)

No paid API keys or exchange logins are required to run and test the complete application.

1. Ensure `USE_MOCK_MARKET_DATA=true` is set in your `.env.local` (or leave it unset; it defaults to `true`).
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Navigate to `http://localhost:3000/live-market`.
4. The dashboard will display the **🟡 DEMO DATA** status chip with realistic price action, tick feeds, subscription books, and GMP trends.

---

### 6. How to Enable Live Mode

To connect to live exchange feeds:

1. Add your valid credentials to `.env.local`:
   ```env
   USE_MOCK_MARKET_DATA=false
   UPSTOX_CLIENT_ID=your_client_id
   UPSTOX_CLIENT_SECRET=your_client_secret
   UPSTOX_ACCESS_TOKEN=your_live_token
   ```
2. Restart the development server.
3. The dashboard will display the **🟢 LIVE** status indicator.

---

### 7. Real-Time Streaming Architecture

- **SSE / WebSocket Endpoint**: `/api/market/stream?symbols=SWIGGY,TATATECH`
- Emits high-frequency JSON ticks containing:
  - `ltp`: Last Traded Price
  - `change`: Absolute price delta
  - `changePercent`: Percentage change
  - `volume`: Cumulative traded volume
  - `high`, `low`, `open`, `close`
- Frontend components auto-reconnect on network drops and gracefully handle offline states.

---

### 8. Database Schema Extensions

Drizzle ORM schema has been extended in `src/db/schema.ts` with:

- `iposTable`: Master table for IPO issues and company metadata.
- `ipoSubscriptionsTable`: Historical and live category-wise subscription multiples.
- `ipoGmpHistoryTable`: Timestamps, price deltas, and estimated listing gains.
- `marketQuotesTable`: Cached real-time market quotes (LTP, OHLC, volume).
- `marketOhlcTable`: Intraday and historical candlestick bars.
- `marketWatchlistTable`: User-curated watchlist with alerts and tracking.

---

### 9. API Endpoints

#### Live Market & Overview
- `GET /api/live-market` — Full market overview, top gainers, top subscribed, and active alerts.
- `GET /api/ipos/upcoming` — Forthcoming IPOs.
- `GET /api/ipos/open` — Currently active IPOs open for bidding.
- `GET /api/ipos/closed` — Issues that have concluded bidding.
- `GET /api/ipos/listed` — Newly and recently listed IPOs with day change %.

#### IPO Details & Analytics
- `GET /api/ipos/:symbol` — Deep-dive prospectus, timetable, and registrar details.
- `GET /api/ipos/:symbol/subscription` — Real-time subscription breakdown (Retail, NII, QIB, Employee, Total).
- `GET /api/ipos/:symbol/gmp` — Current Grey Market Premium and percentage estimate.
- `GET /api/ipos/:symbol/gmp/history?timeframe=7D` — Historical GMP trend curve (`1D`, `7D`, `1M`, `All`).

#### Market Quotes & Charts
- `GET /api/market/:symbol/quote` — Live ticker quote (LTP, OHLC, day change, volume).
- `GET /api/market/:symbol/ohlc?timeframe=1D` — Multi-timeframe OHLC candlestick bars (`1m` to `1M`).
- `GET /api/market/stream?symbols=...` — Real-time Server-Sent Events tick stream.
- `GET /api/market/watchlist` — Retrieve saved symbols.
- `POST /api/market/watchlist` — Add or remove symbols from watchlist.

---

### 10. Regulatory Disclaimer

> **Grey Market Premium (GMP) Disclaimer:**
> Grey Market Premium is an unofficial, unregulated indicator traded over-the-counter and is not endorsed by SEBI, NSE, or BSE. GMP does not guarantee actual listing gains or exchange opening prices.

---

### 11. Troubleshooting

- **Server-Sent Events / WebSocket connection dropped:**
  The frontend chart displays `🔴 DISCONNECTED` and triggers exponential backoff reconnection. Check your network or refresh with the Sync button.
- **Unlisted IPO chart showing benchmark:**
  Primary issues that have not listed on the exchange do not have secondary market ticker symbols; IPOLENS automatically displays the primary issue order book and NIFTY 50 reference feed.
- **Stale Cache:**
  Click the "Sync NSE" or "Refresh" button in the header to purge in-memory cache and fetch fresh exchange telemetry.
