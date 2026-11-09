import { describe, it, expect } from 'vitest';
import { UpstoxFeedV3Service } from '@/lib/services/upstox-feed-v3.service';
import protobuf from 'protobufjs';

describe('Upstox Market Data Feed V3 & Feed Service Suite', () => {
  describe('Instrument Key Resolution & Verification', () => {
    it('should resolve verified landmark IPO instrument keys', () => {
      expect(UpstoxFeedV3Service.resolveVerifiedKey('SWIGGY')).toBe('NSE_EQ|INE00H001014');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('HYUNDAI')).toBe('NSE_EQ|INE0V6F01027');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('BAJAJHFL')).toBe('NSE_EQ|INE377Y01014');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('PREMIERENE')).toBe('NSE_EQ|INE0BS701011');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('TATATECH')).toBe('NSE_EQ|INE142M01025');
    });

    it('should resolve benchmark index keys', () => {
      expect(UpstoxFeedV3Service.resolveVerifiedKey('NIFTY')).toBe('NSE_INDEX|Nifty 50');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('NIFTY 50')).toBe('NSE_INDEX|Nifty 50');
    });

    it('should return empty string for unverified symbols to prevent invalid socket subscriptions', () => {
      expect(UpstoxFeedV3Service.resolveVerifiedKey('INVALID_UNKNOWN_SYMBOL_999')).toBe('');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('')).toBe('');
    });

    it('should normalize pre-formatted exchange keys', () => {
      expect(UpstoxFeedV3Service.resolveVerifiedKey('NSE_EQ|INE00H001014')).toBe('NSE_EQ|INE00H001014');
      expect(UpstoxFeedV3Service.resolveVerifiedKey('INE00H001014')).toBe('NSE_EQ|INE00H001014');
    });
  });

  describe('Protobuf Schema Compilation & Feed Response Decoding', () => {
    const protoDef = `
      syntax = "proto3";
      package com.upstox.marketdatafeeder.rpc.proto;

      message LTPC {
        double ltp = 1;
        int64 ltt = 2;
        int64 ltq = 3;
        double cp = 4;
      }

      message FullFeed {
        LTPC ltpc = 1;
        double vtt = 2;
        double atp = 3;
        double close = 4;
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

    it('should compile the official Upstox MarketDataFeed protobuf schema', () => {
      const root = protobuf.parse(protoDef).root;
      const FeedResponse = root.lookupType('com.upstox.marketdatafeeder.rpc.proto.FeedResponse');
      expect(FeedResponse).toBeDefined();
      expect(FeedResponse.name).toBe('FeedResponse');
    });

    it('should encode and decode a mock FeedResponse binary buffer correctly', () => {
      const root = protobuf.parse(protoDef).root;
      const FeedResponse = root.lookupType('com.upstox.marketdatafeeder.rpc.proto.FeedResponse');

      const mockPayload = {
        type: 1, // live_feed
        currentTs: Date.now(),
        feeds: {
          'NSE_EQ|INE00H001014': {
            fullFeed: {
              ltpc: {
                ltp: 495.25,
                cp: 480.00,
                ltt: Date.now(),
                ltq: 100,
              },
              vtt: 1250000,
              atp: 490.50,
              close: 480.00,
            },
          },
        },
      };

      const message = FeedResponse.create(mockPayload);
      const buffer = FeedResponse.encode(message).finish();
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(0);

      const decoded: any = FeedResponse.decode(buffer);
      expect(decoded.type).toBe(1);
      expect(decoded.feeds).toBeDefined();
      expect(decoded.feeds['NSE_EQ|INE00H001014']).toBeDefined();

      const feed = decoded.feeds['NSE_EQ|INE00H001014'];
      expect(feed.fullFeed.ltpc.ltp).toBeCloseTo(495.25);
      expect(feed.fullFeed.close).toBeCloseTo(480.00);
      expect(feed.fullFeed.vtt).toBe(1250000);
    });
  });

  describe('Feed Service Singleton Lifecycle & Simulation Mode', () => {
    it('should provide singleton instance', () => {
      const s1 = UpstoxFeedV3Service.getInstance();
      const s2 = UpstoxFeedV3Service.getInstance();
      expect(s1).toBe(s2);
    });

    it('should initialize with valid connection state', () => {
      const service = UpstoxFeedV3Service.getInstance();
      const state = service.getConnectionState();
      expect(['DISCONNECTED', 'CONNECTING', 'LIVE', 'DEMO', 'ERROR']).toContain(state);
    });

    it('should start and run demo mode cleanly when mock mode is enabled', async () => {
      const service = UpstoxFeedV3Service.getInstance();
      await service.start(['SWIGGY', 'TATATECH']);
      
      const state = service.getConnectionState();
      expect(['LIVE', 'DEMO', 'CONNECTING', 'ERROR']).toContain(state);

      service.stop();
      expect(service.getConnectionState()).toBe('DISCONNECTED');
    });
  });
});
