import protobuf from 'protobufjs';
import { getRedisClient } from '@/lib/redis';
import { LISTED_IPOS_REGISTRY } from '@/services/listedIpoService';

export type FeedConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'LIVE' | 'DEMO' | 'ERROR';

export interface DecodedTick {
  symbol: string;
  instrumentKey: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp: string;
  feed: 'UPSTOX_V3' | 'SIMULATED_DEMO';
  isMock: boolean;
}

// Protobuf schema for Upstox Market Data Feed V3
const UPSTOX_PROTO_DEFINITION = `
syntax = "proto3";
package com.upstox.marketdatafeeder.rpc.proto;

message LTPC {
  double ltp = 1;
  int64 ltt = 2;
  int64 ltq = 3;
  double cp = 4;
}

message MarketLevel {
  repeated Quote bidAskQuote = 1;
}

message Quote {
  int32 bq = 1;
  int32 bp = 2;
  int32 b_orders = 3;
  int32 sq = 4;
  int32 sp = 5;
  int32 s_orders = 6;
}

message MarketOHLC {
  repeated OHLC ohlc = 1;
}

message OHLC {
  string interval = 1;
  double open = 2;
  double high = 3;
  double low = 4;
  double close = 5;
  int32 volume = 6;
  int64 ts = 7;
}

message FullFeed {
  MarketOHLC marketOHLC = 1;
  MarketLevel marketLevel = 2;
  LTPC ltpc = 3;
  double vtt = 4;
  double atp = 5;
  double oi = 6;
  double close = 7;
}

message Feed {
  oneof FeedUnion {
    LTPC ltpc = 1;
    FullFeed fullFeed = 2;
  }
}

message FeedResponse {
  enum Type {
    initial_feed = 0;
    live_feed = 1;
  }
  Type type = 1;
  map<string, Feed> feeds = 2;
  int64 currentTs = 3;
}
`;

// Parse schema once
let feedResponseType: protobuf.Type | null = null;
try {
  const root = protobuf.parse(UPSTOX_PROTO_DEFINITION).root;
  feedResponseType = root.lookupType('com.upstox.marketdatafeeder.rpc.proto.FeedResponse');
} catch (err: any) {
  console.error('[UpstoxFeedV3] Protobuf compile error:', err.message);
}

// Pre-mapped instrument keys for listed IPOs
const KNOWN_INSTRUMENTS: Record<string, string> = {
  SWIGGY: 'NSE_EQ|INE00H001014',
  HYUNDAI: 'NSE_EQ|INE0V6F01027',
  BAJAJHFL: 'NSE_EQ|INE377Y01014',
  PREMIERENE: 'NSE_EQ|INE0BS701011',
  KRN: 'NSE_EQ|INE0Q3J01015',
  NETWEB: 'NSE_EQ|INE0NT901020',
  TATATECH: 'NSE_EQ|INE142M01025',
  IREDA: 'NSE_EQ|INE202E01016',
  DOMS: 'NSE_EQ|INE321T01012',
  JYOTICNC: 'NSE_EQ|INE980O01024',
  MANKIND: 'NSE_EQ|INE634S01028',
  DEEDEV: 'NSE_EQ|INE841L01016',
  CONCORDBIO: 'NSE_EQ|INE338H01029',
  NORTHARC: 'NSE_EQ|INE850M01015',
  ARKADE: 'NSE_EQ|INE0QRL01017',
  WCIL: 'NSE_EQ|INE0CJF01024',
  SBFC: 'NSE_EQ|INE423Y01016',
  KAYNES: 'NSE_EQ|INE918Z01012',
  FIRSTCRY: 'NSE_EQ|INE02RE01045',
  OLAELEC: 'NSE_EQ|INE0LXG01040',
  SANSTAR: 'NSE_EQ|INE08NE01025',
  BANSALWIRE: 'NSE_EQ|INE0B9K01025',
  EMCURE: 'NSE_EQ|INE168P01015',
  AKUMS: 'NSE_EQ|INE09XN01023',
  CEIGALL: 'NSE_EQ|INE0AG901020',
  WAAREE: 'NSE_EQ|INE377N01017',
  WAAREEENER: 'NSE_EQ|INE377N01017',
  GARUDA: 'NSE_EQ|INE0JVO01026',
  NIFTY: 'NSE_INDEX|Nifty 50',
};

// Reverse map from instrumentKey to symbol
const KEY_TO_SYMBOL_MAP: Map<string, string> = new Map();
for (const [sym, key] of Object.entries(KNOWN_INSTRUMENTS)) {
  KEY_TO_SYMBOL_MAP.set(key, sym);
  KEY_TO_SYMBOL_MAP.set(key.replace('|', ':'), sym);
}

export class UpstoxFeedV3Service {
  private static instance: UpstoxFeedV3Service | null = null;
  private ws: any = null;
  private connectionState: FeedConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private simInterval: NodeJS.Timeout | null = null;
  private subscribedKeys: Set<string> = new Set();
  private lastTickMap: Map<string, DecodedTick> = new Map();
  private lastError: string | null = null;
  private isShuttingDown = false;

  private constructor() {}

  static getInstance(): UpstoxFeedV3Service {
    if (!UpstoxFeedV3Service.instance) {
      UpstoxFeedV3Service.instance = new UpstoxFeedV3Service();
    }
    return UpstoxFeedV3Service.instance;
  }

  getConnectionState(): FeedConnectionState {
    return this.connectionState;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getLatestTick(symbol: string): DecodedTick | undefined {
    return this.lastTickMap.get(symbol.toUpperCase().trim());
  }

  /**
   * Resolve an instrument key for a symbol.
   * Returns empty string if unverified to prevent invalid subscriptions.
   */
  static resolveVerifiedKey(symbol: string): string {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    if (clean === 'NIFTY' || clean === 'NIFTY 50') return 'NSE_INDEX|Nifty 50';
    if (clean.startsWith('NSE_EQ|') || clean.startsWith('NSE_INDEX|')) return clean;
    if (clean.startsWith('INE')) return `NSE_EQ|${clean}`;
    if (KNOWN_INSTRUMENTS[clean]) return KNOWN_INSTRUMENTS[clean];
    return '';
  }

  /**
   * Resolve server-side access token (daily OAuth or 1-year Analytics Token)
   */
  private getAccessToken(): string {
    const token = process.env.UPSTOX_ACCESS_TOKEN || '';
    if (!token || token.includes('your_') || token.includes('YOUR_') || token.length < 20) {
      return '';
    }
    return token.trim();
  }

  /**
   * Request authorized WebSocket redirect URI from Upstox Market Data Feed V3 Authorize endpoint
   */
  private async getAuthorizedWsUrl(token: string): Promise<string | null> {
    const endpoints = [
      'https://api.upstox.com/v3/feed/market-data-feed/authorize',
      'https://api.upstox.com/v2/feed/market-data-feed/authorize',
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const json = await res.json();
          const redirectUri = json?.data?.authorizedRedirectUri || json?.data?.authorized_redirect_uri;
          if (redirectUri && typeof redirectUri === 'string') {
            return redirectUri;
          }
        }
      } catch (err: any) {
        console.warn(`[UpstoxFeedV3] Auth request notice for ${url}: ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Start the market data feed worker.
   * Avoids duplicate connections if already running.
   */
  async start(customSymbols?: string[]): Promise<void> {
    if (this.connectionState === 'LIVE' || this.connectionState === 'CONNECTING') {
      return;
    }

    this.isShuttingDown = false;
    const token = this.getAccessToken();

    // Collect verified instrument keys
    const symbolsToTrack = customSymbols && customSymbols.length > 0
      ? customSymbols
      : LISTED_IPOS_REGISTRY.map((r) => r.symbol);

    this.subscribedKeys.clear();
    for (const sym of symbolsToTrack) {
      const key = UpstoxFeedV3Service.resolveVerifiedKey(sym);
      if (key) {
        this.subscribedKeys.add(key);
      }
    }
    // Always include benchmark index
    this.subscribedKeys.add('NSE_INDEX|Nifty 50');

    // If explicit mock mode requested or no token configured, start simulated demo
    if (process.env.USE_MOCK_MARKET_DATA === 'true' || !token) {
      console.log('[UpstoxFeedV3] Mock mode enabled or no UPSTOX_ACCESS_TOKEN. Starting simulated demo stream.');
      this.connectionState = 'DEMO';
      this.startSimulatedDemoFeed();
      return;
    }

    this.connectionState = 'CONNECTING';
    await this.connectUpstoxWs(token);
  }

  /**
   * Establish WebSocket connection with redirect handling and exponential backoff
   */
  private async connectUpstoxWs(token: string): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const wsUrl = await this.getAuthorizedWsUrl(token);

      if (!wsUrl) {
        throw new Error('Could not obtain authorized redirect URI from Upstox Feed V3 API');
      }

      // Check global WebSocket support (Node 22+ built-in)
      const WebSocketCtor: any = (globalThis as any).WebSocket;
      if (!WebSocketCtor) {
        throw new Error('WebSocket is not supported in this runtime environment');
      }

      this.ws = new WebSocketCtor(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.connectionState = 'LIVE';
        this.reconnectAttempts = 0;
        this.lastError = null;
        console.log(`[UpstoxFeedV3] WebSocket connected. Subscribing to ${this.subscribedKeys.size} verified instruments.`);

        // Send V3 subscription message
        const subMessage = {
          guid: 'ipolens-feed-v3',
          method: 'sub',
          data: {
            mode: 'full',
            instrumentKeys: Array.from(this.subscribedKeys).slice(0, 100),
          },
        };

        try {
          this.ws.send(JSON.stringify(subMessage));
        } catch (subErr: any) {
          console.warn('[UpstoxFeedV3] Error sending subscription payload:', subErr.message);
        }
      };

      this.ws.onmessage = (event: any) => {
        try {
          const buffer = event.data instanceof ArrayBuffer
            ? new Uint8Array(event.data)
            : Buffer.isBuffer(event.data)
            ? new Uint8Array(event.data)
            : null;

          if (buffer) {
            this.handleBinaryMessage(buffer);
          }
        } catch (msgErr: any) {
          console.warn('[UpstoxFeedV3] Error handling feed frame:', msgErr.message);
        }
      };

      this.ws.onerror = (err: any) => {
        this.lastError = err?.message || 'WebSocket connection error';
        console.warn('[UpstoxFeedV3] WebSocket error:', this.lastError);
      };

      this.ws.onclose = () => {
        if (this.isShuttingDown) return;
        this.connectionState = 'DISCONNECTED';
        console.warn('[UpstoxFeedV3] WebSocket disconnected. Scheduling reconnect...');
        this.scheduleReconnect(token);
      };
    } catch (err: any) {
      this.lastError = err.message;
      this.connectionState = 'ERROR';
      console.warn('[UpstoxFeedV3] Connection setup failed:', err.message);
      this.scheduleReconnect(token);
    }
  }

  /**
   * Exponential backoff reconnect
   */
  private scheduleReconnect(token: string): void {
    if (this.isShuttingDown || this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(30000, 2000 * Math.pow(2, Math.min(4, this.reconnectAttempts - 1)));
    console.log(`[UpstoxFeedV3] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.reconnectAttempts > 5) {
        // Fallback to demo simulator after repeated failures
        console.warn('[UpstoxFeedV3] Multiple reconnect failures. Falling back to simulated demo feed.');
        this.connectionState = 'DEMO';
        this.startSimulatedDemoFeed();
        return;
      }
      this.connectionState = 'CONNECTING';
      await this.connectUpstoxWs(token);
    }, delay);
  }

  /**
   * Decode binary Protobuf frames from Upstox Market Data Feed V3
   */
  private async handleBinaryMessage(buffer: Uint8Array): Promise<void> {
    if (!feedResponseType) return;

    try {
      const decoded: any = feedResponseType.decode(buffer);
      const feeds = decoded.feeds || {};
      const redis = getRedisClient();

      for (const [rawKey, feed] of Object.entries<any>(feeds)) {
        const colonKey = rawKey.replace('|', ':');
        const symbol = KEY_TO_SYMBOL_MAP.get(rawKey) || KEY_TO_SYMBOL_MAP.get(colonKey) || rawKey;

        let ltp = 0;
        let close = 0;
        let high = 0;
        let low = 0;
        let open = 0;
        let volume = 0;

        if (feed.fullFeed) {
          ltp = feed.fullFeed.ltpc?.ltp || 0;
          close = feed.fullFeed.close || feed.fullFeed.ltpc?.cp || ltp;
          volume = feed.fullFeed.vtt || 0;
          const ohlcList = feed.fullFeed.marketOHLC?.ohlc || [];
          if (ohlcList.length > 0) {
            const first = ohlcList[0];
            open = first.open || 0;
            high = first.high || 0;
            low = first.low || 0;
          }
        } else if (feed.ltpc) {
          ltp = feed.ltpc.ltp || 0;
          close = feed.ltpc.cp || ltp;
        }

        if (ltp > 0) {
          const change = close > 0 ? Number((ltp - close).toFixed(2)) : 0;
          const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

          const tick: DecodedTick = {
            symbol,
            instrumentKey: rawKey,
            ltp,
            change,
            changePercent,
            open: open || ltp,
            high: high || ltp,
            low: low || ltp,
            close,
            volume,
            timestamp: new Date().toISOString(),
            feed: 'UPSTOX_V3',
            isMock: false,
          };

          this.lastTickMap.set(symbol, tick);

          // Cache in Redis for sub-second REST access & publish to SSE
          try {
            await redis.set(`quote:${symbol}`, JSON.stringify(tick), 'EX', 120);
            await redis.set(`ipo:live:${symbol}`, JSON.stringify(tick), 'EX', 120);
            await redis.publish(
              'market-ticks',
              JSON.stringify({
                type: 'TICK',
                ...tick,
              })
            );
          } catch {
            // Redis optional
          }
        }
      }
    } catch (decodeErr: any) {
      console.warn('[UpstoxFeedV3] Protobuf decode notice:', decodeErr.message);
    }
  }

  /**
   * Simulated demo feed for offline development (clearly tagged as SIMULATED_DEMO)
   */
  private startSimulatedDemoFeed(): void {
    if (this.simInterval) return;

    const baseQuotes: Record<string, number> = {
      SWIGGY: 485.40,
      HYUNDAI: 1845.20,
      BAJAJHFL: 142.60,
      PREMIERENE: 1120.50,
      KRN: 512.75,
      NETWEB: 2840.10,
      TATATECH: 924.30,
      IREDA: 218.40,
      DOMS: 2680.00,
      WAAREE: 2980.50,
      'Nifty 50': 24150.00,
    };

    const redis = getRedisClient();

    this.simInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      const symbols = Object.keys(baseQuotes);
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      const base = baseQuotes[randomSymbol];
      const variance = (Math.random() - 0.49) * (base * 0.006);
      const ltp = Number((base + variance).toFixed(2));
      const change = Number((variance * 2).toFixed(2));
      const changePercent = Number(((change / base) * 100).toFixed(2));

      const tick: DecodedTick = {
        symbol: randomSymbol,
        instrumentKey: KNOWN_INSTRUMENTS[randomSymbol] || `NSE_EQ|${randomSymbol}`,
        ltp,
        change,
        changePercent,
        open: base,
        high: Math.max(base, ltp),
        low: Math.min(base, ltp),
        close: base,
        volume: Math.floor(Math.random() * 50000) + 10000,
        timestamp: new Date().toISOString(),
        feed: 'SIMULATED_DEMO',
        isMock: true,
      };

      this.lastTickMap.set(randomSymbol, tick);

      try {
        await redis.set(`quote:${randomSymbol}`, JSON.stringify(tick), 'EX', 60);
        await redis.publish(
          'market-ticks',
          JSON.stringify({
            type: 'TICK',
            ...tick,
          })
        );
      } catch {
        // Redis optional
      }
    }, 2500);
  }

  /**
   * Safely stop the worker
   */
  stop(): void {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connectionState = 'DISCONNECTED';
  }
}

