import { getRedisClient } from '../redis';
import { logger } from '../logger.util';

const redis = getRedisClient();

/**
 * Angel One SmartAPI credential types
 */
export interface AngelOneCredentials {
  jwtToken: string;
  feedToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface TokenRefreshResult {
  success: boolean;
  credentials?: AngelOneCredentials;
  error?: string;
}

/**
 * AuthTokenService handles automated refresh of Angel One SmartAPI credentials.
 * JWT tokens and feed tokens expire daily (typically 24 hours).
 *
 * This service provides:
 * - Scheduled token refresh orchestration
 * - Credential caching via Redis
 * - Fallback to manual refresh when automation fails
 */
export class AuthTokenService {
  private static readonly BASE_URL = 'https://apiconnect.angelbroking.com';
  private static readonly REFRESH_ENDPOINT = '/rest/secure/angelbroking/jwt/validate';
  private static readonly DEFAULT_REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20 hours
  private static readonly CACHE_TTL_SECONDS = 22 * 60 * 60; // 22 hours (slightly less than 24h expiry)

  /**
   * Refresh Angel One JWT token using refresh token or client credentials.
   * Falls back to environment variables when refresh token unavailable.
   */
  static async refreshJwtToken(): Promise<TokenRefreshResult> {
    const clientCode = process.env.ANGEL_ONE_CLIENT_CODE;
    const apiKey = process.env.ANGEL_ONE_API_KEY;
    const refreshToken = process.env.ANGEL_ONE_REFRESH_TOKEN;

    if (!clientCode || !apiKey) {
      return {
        success: false,
        error: 'ANGEL_ONE_CLIENT_CODE and ANGEL_ONE_API_KEY are required for token refresh',
      };
    }

    try {
      // Option 1: Use refresh token if available (preferred)
      if (refreshToken) {
        const response = await fetch(`${this.BASE_URL}${this.REFRESH_ENDPOINT}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${refreshToken}`,
            'X-PrivateKey': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status && data.data?.token) {
            const credentials: AngelOneCredentials = {
              jwtToken: data.data.token,
              feedToken: process.env.ANGEL_ONE_FEED_TOKEN || '',
              expiresAt: Date.now() + this.DEFAULT_REFRESH_INTERVAL_MS,
            };
            return { success: true, credentials };
          }
        }
      }

      // Option 2: Validate existing JWT (if still valid)
      // Option 3: Manual refresh flow - user must update env vars
      return {
        success: false,
        error: 'Token refresh requires ANGEL_ONE_REFRESH_TOKEN or manual JWT update. Check Angel One API documentation.',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during token refresh';
      logger.error('Token refresh failed', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Validate existing JWT token against Angel One API.
   * Returns true if token is still valid.
   */
  static async validateJwtToken(token: string): Promise<boolean> {
    if (!token) return false;

    try {
      const response = await fetch(`${this.BASE_URL}/rest/secure/angelbroking/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get cached credentials from Redis or environment variables.
   */
  static async getCredentials(): Promise<AngelOneCredentials | null> {
    // Try Redis cache first
    try {
      const cached = await redis.get('ipolens:angelone:credentials');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if still valid (not expired)
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return parsed;
        }
      }
    } catch (err) {
      logger.warn('Failed to read credentials from Redis', { error: String(err) });
    }

    // Fall back to environment variables
    const jwtToken = process.env.ANGEL_ONE_JWT_TOKEN;
    const feedToken = process.env.ANGEL_ONE_FEED_TOKEN;

    if (jwtToken && feedToken) {
      return {
        jwtToken,
        feedToken,
        expiresAt: Date.now() + this.DEFAULT_REFRESH_INTERVAL_MS,
      };
    }

    return null;
  }

  /**
   * Cache credentials in Redis for shared access across instances.
   */
  static async cacheCredentials(credentials: AngelOneCredentials): Promise<void> {
    try {
      await redis.set(
        'ipolens:angelone:credentials',
        JSON.stringify(credentials),
        'EX',
        this.CACHE_TTL_SECONDS
      );
    } catch (err) {
      logger.warn('Failed to cache credentials', { error: String(err) });
    }
  }

  /**
   * Check if credentials need refresh (expires within 1 hour or not set).
   */
  static async needsRefresh(): Promise<boolean> {
    const credentials = await this.getCredentials();

    if (!credentials?.expiresAt) {
      return true;
    }

    // Refresh if expires within 1 hour
    const oneHourMs = 60 * 60 * 1000;
    return credentials.expiresAt - Date.now() < oneHourMs;
  }

  /**
   * Perform scheduled token refresh with caching.
   * Use with scheduler like cron or Trigger.dev.
   */
  static async performScheduledRefresh(): Promise<TokenRefreshResult> {
    logger.info('Starting scheduled Angel One token refresh');

    const refreshResult = await this.refreshJwtToken();

    if (refreshResult.success && refreshResult.credentials) {
      await this.cacheCredentials(refreshResult.credentials);
      logger.info('Angel One credentials refreshed and cached successfully');
    } else {
      // Update env vars if refresh succeeded but cache failed
      const currentJwt = process.env.ANGEL_ONE_JWT_TOKEN;
      const currentFeed = process.env.ANGEL_ONE_FEED_TOKEN;

      if (currentJwt && currentFeed) {
        await this.cacheCredentials({
          jwtToken: currentJwt,
          feedToken: currentFeed,
          expiresAt: Date.now() + this.DEFAULT_REFRESH_INTERVAL_MS,
        });
        logger.info('Credentials cached from environment (scheduled refresh not configured)');
      }
    }

    return refreshResult;
  }
}

/**
 * Run scheduled token refresh (for cron jobs or startup scripts).
 * Usage: node workers/token-refresh.js
 */
if (require.main === module) {
  AuthTokenService.performScheduledRefresh()
    .then((result) => {
      console.log(JSON.stringify(result));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Scheduled refresh failed:', err);
      process.exit(1);
    });
}