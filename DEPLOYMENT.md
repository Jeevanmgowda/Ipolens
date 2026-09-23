# IPOLENS Deployment Guide

This document provides deployment strategies for the IPOLENS backend services, addressing the **Worker Isolation** requirement from the implementation checklist.

## Overview

IPOLENS separates concerns into:
- **Secondary Market Data**: Live stock prices & charts via Angel One SmartAPI
- **Primary Market Intelligence**: IPO data, subscription multiples, GMP via ingestion pipelines
- **Background Workers**: Market feed worker, token refresh service

## Deployment Options

### 1. Trigger.dev (Recommended for Serverless)

**Best for**: Event-driven workloads, automatic scaling, zero infrastructure management

#### Setup:
1. Create account at [trigger.dev](https://trigger.dev)
2. Install CLI: `npm i -g @trigger.dev/cli`
3. Initialize project: `trigger.dev init`
4. Deploy workers:

#### Worker Configuration (`trigger.config.ts`):
```typescript
import { defineWorker } from "@trigger.dev/sdk";
import { tokenRefreshWorker } from "./src/lib/scheduler";

// Token refresh worker (runs every 20 hours)
export const tokenRefreshWorker = defineWorker({
  id: "token-refresh",
  name: "Angel One Token Refresh",
  version: "1.0.0",
  // Run every 20 hours (slightly under 24h token expiry)
  cron: "0 */20 * * *",
  // Required environment variables
  environment: {
    ANGEL_ONE_CLIENT_CODE: "{{ANGEL_ONE_CLIENT_CODE}}",
    ANGEL_ONE_API_KEY: "{{ANGEL_ONE_API_KEY}}",
    ANGEL_ONE_JWT_TOKEN: "{{ANGEL_ONE_JWT_TOKEN}}",
    ANGEL_ONE_FEED_TOKEN: "{{ANGEL_ONE_FEED_TOKEN}}",
    UPSTASH_REDIS_URL: "{{UPSTASH_REDIS_URL}}",
  },
  // Task definition
  run: async (payload, io, ctx) => {
    const { AuthTokenService } = await import("@/lib/services/auth-token.service");
    const result = await AuthTokenService.performScheduledRefresh();
    
    if (!result.success) {
      throw new Error(`Token refresh failed: ${result.error}`);
    }
    
    return result;
  }
});

// Market feed worker (continuous WebSocket connection)
export const marketFeedWorker = defineWorker({
  id: "market-feed",
  name: "Angel One Market Feed",
  version: "1.0.0",
  // Run continuously (or use a long-running trigger)
  event: {
    name: "start-market-feed"
  },
  environment: {
    ANGEL_ONE_CLIENT_CODE: "{{ANGEL_ONE_CLIENT_CODE}}",
    ANGEL_ONE_FEED_TOKEN: "{{ANGEL_ONE_FEED_TOKEN}}",
    ANGEL_ONE_API_KEY: "{{ANGEL_ONE_API_KEY}}",
    UPSTASH_REDIS_URL: "{{UPSTASH_REDIS_URL}}",
  },
  run: async (payload, io, ctx) => {
    const { startLivePriceWorker } = await import("./workers/market-feed-worker");
    
    // Start the worker
    const ws = startLivePriceWorker(
      process.env.ANGEL_ONE_CLIENT_CODE,
      process.env.ANGEL_ONE_FEED_TOKEN,
      process.env.ANGEL_ONE_API_KEY
    );
    
    // Keep worker alive for trigger duration (max 30 min for free tier)
    await io.waitUntil("worker-timeout", { seconds: 1800 });
    
    // Cleanup
    // Note: WebSocket cleanup happens automatically when worker terminates
  }
});
```

#### Deployment:
```bash
# Deploy all workers
trigger.dev deploy

# Monitor deployments
trigger.dev logs
```

### 2. Inngest (Alternative Event-Driven Platform)

**Best for**: Workflow orchestration, reliable execution, built-in retries

#### Setup:
1. Create account at [inngest.com](https://inngest.com)
2. Install SDK: `npm i inngest`
3. Create Inngest client:

#### Worker Functions (`src/lib/inngest.ts`):
```typescript
import { Inngest } from "inngest";
import { AuthTokenService } from "./services/auth-token.service";
import { startLivePriceWorker } from "./workers/market-feed-worker";

// Initialize Inngest client
export const inngest = new Inngest({
  id: "ipolens-backend",
  name: "IPOLENS Backend Services",
  // Retry configuration
  retry: {
    limit: 3,
    delay: "exponential",
  }
});

// Token refresh function (scheduled every 20 hours)
export const refreshAngelOneTokens = inngest.createFunction(
  { id: "refresh-angel-one-tokens" },
  { cron: "0 */20 * * *" }, // Every 20 hours
  async ({ event }) => {
    const result = await AuthTokenService.performScheduledRefresh();
    
    if (!result.success) {
      throw new Error(`Token refresh failed: ${result.error}`);
    }
    
    return { success: true, refreshedAt: new Date().toISOString() };
  }
);

// Market feed worker (triggered via HTTP or event)
export const startMarketFeed = inngest.createFunction(
  { id: "start-market-feed" },
  { event: "market/feed.start" },
  async ({ event, step }) => {
    // Start WebSocket connection
    const ws = await step.run("start-websocket", () => 
      startLivePriceWorker(
        process.env.ANGEL_ONE_CLIENT_CODE,
        process.env.ANGEL_ONE_FEED_TOKEN,
        process.env.ANGEL_ONE_API_KEY
      )
    );
    
    // Keep alive for specified duration (or until stopped)
    await step.waitFor("websocket-duration", { 
      timeout: "2h" 
    });
    
    return { status: "completed" };
  }
);
```

#### Deployment:
```bash
# Deploy functions
npx inngest-cli deploy --sync

# Start dev server (for local testing)
npx inngest-cli dev
```

### 3. Celery with Redis Broker (Self-Hosted)

**Best for**: Existing Python infrastructure, complex task routing, mature ecosystem

#### Setup:
1. Install Redis: `redis-server` or use managed Redis (Upstash/AWS Elasticache)
2. Install Celery: `pip install celery redis`
3. Configure Celery app:

#### Celery Configuration (`celeryconfig.py`):
```python
# Celery configuration for IPOLENS
broker_url = 'redis://:${UPSTASH_REDIS_PASSWORD}@${UPSTASH_REDIS_HOST}:${UPSTASH_REDIS_PORT}'
result_backend = 'redis://:${UPSTASH_REDIS_PASSWORD}@${UPSTASH_REDIS_HOST}:${UPSTASH_REDIS_PORT}'

# Task serialization
accept_content = ['json']
task_serializer = 'json'
result_serializer = 'json'
timezone = 'UTC'
enable_utc = True

# Task routing
task_routes = {
    'workers.token_refresh.refresh_angel_one_tokens': {'queue': 'token_refresh'},
    'workers.market_feed.start_market_feed': {'queue': 'market_feed'},
}

# Beat schedule (periodic tasks)
from celery.schedules import crontab

beat_schedule = {
    'refresh-angel-one-tokens': {
        'task': 'workers.token_refresh.refresh_angel_one_tokens',
        'schedule': crontab(minute=0, hour='*/20'),  # Every 20 hours
        'options': {'queue': 'token_refresh'}
    },
}

# Worker configuration
worker_prefetch_multiplier = 1
task_acks_late = True
worker_max_tasks_per_child = 1000
```

#### Worker Tasks (`src/workers/celery_tasks.py`):
```python
import json
import time
import requests
from celery import Celery
from typing import Dict, Any
from ioredis import Redis

# Initialize Celery
celery_app = Celery('ipolens_workers')
celery_app.config_from_object('celeryconfig')

# Redis client for caching
redis_client = Redis.from_url(broker_url)

@celery_app.task(bind=True, max_retries=3)
def refresh_angel_one_tokens(self) -> Dict[str, Any]:
    """Refresh Angel One JWT and feed tokens"""
    try:
        # Call Angel One refresh API (simplified - adjust based on actual API)
        client_code = os.getenv('ANGEL_ONE_CLIENT_CODE')
        api_key = os.getenv('ANGEL_ONE_API_KEY')
        refresh_token = os.getenv('ANGEL_ONE_REFRESH_TOKEN')
        
        if not all([client_code, api_key]):
            raise ValueError("Missing required Angel One credentials")
            
        # Use refresh token if available, otherwise manual update needed
        if refresh_token:
            response = requests.get(
                'https://apiconnect.angelbroking.com/rest/secure/angelbroking/jwt/validate',
                headers={
                    'Authorization': f'Bearer {refresh_token}',
                    'X-PrivateKey': api_key,
                    'Content-Type': 'application/json'
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status'):
                    # Cache new tokens
                    credentials = {
                        'jwtToken': data['data']['token'],
                        'feedToken': os.getenv('ANGEL_ONE_FEED_TOKEN', ''),
                        'expiresAt': int(time.time()) + 20 * 3600  # 20 hours
                    }
                    
                    redis_client.setex(
                        'ipolens:angelone:credentials',
                        22 * 3600,  # 22 hours TTL
                        json.dumps(credentials)
                    )
                    
                    return {'success': True, 'message': 'Tokens refreshed successfully'}
        
        raise ValueError("Token refresh requires ANGEL_ONE_REFRESH_TOKEN or manual update")
        
    except Exception as exc:
        # Retry logic handled by Celery
        raise self.retry(exc=exc, countdown=60, max_retries=3)

@celery_app.task(bind=True)
def start_market_feed(self, client_code: str, feed_token: str, api_key: str) -> Dict[str, Any]:
    """Start Angel One market feed WebSocket worker"""
    try:
        # This would typically spawn a long-lived process
        # For Celery, we might use a separate worker process or 
        # implement as a periodic health check
        
        import subprocess
        import os
        
        # Start market feed worker as subprocess
        env = os.environ.copy()
        env.update({
            'ANGEL_ONE_CLIENT_CODE': client_code,
            'ANGEL_ONE_FEED_TOKEN': feed_token,
            'ANGEL_ONE_API_KEY': api_key,
            'UPSTASH_REDIS_URL': broker_url
        })
        
        process = subprocess.Popen([
            'node', 
            './workers/market-feed-worker.js'
        ], env=env)
        
        return {
            'success': True,
            'pid': process.pid,
            'message': 'Market feed worker started'
        }
    except Exception as exc:
        return {
            'success': False,
            'error': str(exc)
        }
```

#### Deployment:
```bash
# Start Redis (if not using managed service)
redis-server

# Start Celery worker
celery -A celeryconfig worker --loglevel=info

# Start Celery beat (scheduler)
celery -A celeryconfig beat --loglevel=info

# Or use supervisord/docker-compose for production
```

### 4. Docker Containerization

**Best for**: Consistent environments, easy deployment, microservices architecture

#### Dockerfile:
```dockerfile
# Use Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY workers ./workers

# Build TypeScript (if needed for production)
# RUN npm run build

# Expose port (for Next.js app)
EXPOSE 3000

# Environment variables (set at runtime)
ENV NODE_ENV=production

# Default command (can be overridden)
CMD ["npm", "start"]
```

#### docker-compose.yml:
```yaml
version: '3.8'

services:
  # Main Next.js application
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - ANGEL_ONE_CLIENT_CODE=${ANGEL_ONE_CLIENT_CODE}
      - ANGEL_ONE_FEED_TOKEN=${ANGEL_ONE_FEED_TOKEN}
      - ANGEL_ONE_API_KEY=${ANGEL_ONE_API_KEY}
      - ANGEL_ONE_JWT_TOKEN=${ANGEL_ONE_JWT_TOKEN}
    depends_on:
      - redis
      - token-refresh
    
  # Redis for caching and pub/sub
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    
  # Token refresh worker (runs every 20 hours)
  token-refresh:
    build: .
    environment:
      - NODE_ENV=production
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
      - ANGEL_ONE_CLIENT_CODE=${ANGEL_ONE_CLIENT_CODE}
      - ANGEL_ONE_FEED_TOKEN=${ANGEL_ONE_FEED_TOKEN}
      - ANGEL_ONE_API_KEY=${ANGEL_ONE_API_KEY}
      - ANGEL_ONE_JWT_TOKEN=${ANGEL_ONE_JWT_TOKEN}
      - ANGEL_ONE_REFRESH_TOKEN=${ANGEL_ONE_REFRESH_TOKEN}
    command: >
      sh -c "
        npm run build &&
        node -e \" 
          require('./src/lib/scheduler').tokenRefreshWorker.initialize().then(() => {
            require('./src/lib/scheduler').tokenRefreshWorker.start();
          });
        "
      )
    depends_on:
      - redis
    restart: unless-stopped
    
  # Market feed worker (continuous WebSocket)
  market-feed:
    build: .
    environment:
      - NODE_ENV=production
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
      - ANGEL_ONE_CLIENT_CODE=${ANGEL_ONE_CLIENT_CODE}
      - ANGEL_ONE_FEED_TOKEN=${ANGEL_ONE_FEED_TOKEN}
      - ANGEL_ONE_API_KEY=${ANGEL_ONE_API_KEY}
    command: >
      sh -c "
        npm run build &&
        node -e \"
          require('./src/lib/scheduler').tokenRefreshWorker.initialize().then(() => {
            require('./src/lib/scheduler').tokenRefreshWorker.start();
          });
        \"
      "
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis_data:
```

#### Deployment:
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale workers (if needed)
docker-compose scale market-feed=3
```

### 5. PM2 Process Manager (Traditional Node.js)

**Best for**: Simple deployments, process monitoring, easy scaling

#### ecosystem.config.js:
```javascript
module.exports = {
  apps: [
    {
      name: 'ipolens-app',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'ipolens-token-refresh',
      script: 'node',
      args: './src/lib/scheduler.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
        ANGEL_ONE_CLIENT_CODE: process.env.ANGEL_ONE_CLIENT_CODE,
        ANGEL_ONE_FEED_TOKEN: process.env.ANGEL_ONE_FEED_TOKEN,
        ANGEL_ONE_API_KEY: process.env.ANGEL_ONE_API_KEY,
        ANGEL_ONE_JWT_TOKEN: process.env.ANGEL_ONE_JWT_TOKEN,
        ANGEL_ONE_REFRESH_TOKEN: process.env.ANGEL_ONE_REFRESH_TOKEN,
      },
    },
    {
      name: 'ipolens-market-feed',
      script: 'node',
      args: './workers/market-feed-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
        ANGEL_ONE_CLIENT_CODE: process.env.ANGEL_ONE_CLIENT_CODE,
        ANGEL_ONE_FEED_TOKEN: process.env.ANGEL_ONE_FEED_TOKEN,
        ANGEL_ONE_API_KEY: process.env.ANGEL_ONE_API_KEY,
      },
    },
  ],
};
```

#### Deployment:
```bash
# Install PM2 globally
npm i -g pm2

# Start all processes
pm2 start ecosystem.config.js

# Save process list for resurrection
pm2 save

# Set up startup script (Linux)
pm2 startup systemd

# Monitor processes
pm2 monit

# View logs
pm2 logs
```

## Environment Variables

Required environment variables for all deployment options:

| Variable | Description | Required |
|----------|-------------|----------|
| `UPSTASH_REDIS_URL` | Redis connection string (Upstash or self-hosted) | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for DRHP analysis | Yes |
| `ANGEL_ONE_CLIENT_CODE` | Angel One SmartAPI client code | Yes |
| `ANGEL_ONE_FEED_TOKEN` | Angel One WebSocket feed token | Yes |
| `ANGEL_ONE_API_KEY` | Angel One SmartAPI API key | Yes |
| `ANGEL_ONE_JWT_TOKEN` | Angel One JWT token for REST API | Yes |
| `ANGEL_ONE_REFRESH_TOKEN` | Angel One refresh token (optional, for automated refresh) | No |
| `NODE_ENV` | Node environment (development/production) | No (defaults to development) |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | No (defaults to info) |

## Monitoring & Observability

### Health Check Endpoints
All deployment options should include:
- **Liveness Probe**: `GET /api/health` (returns 200 if service is alive)
- **Readiness Probe**: `GET /api/ready` (returns 200 if service can handle requests)
- **Metrics Endpoint**: `GET /api/metrics` (Prometheus-compatible metrics)

### Log Aggregation
- **Development**: Console output with color-coded levels
- **Production**: Structured JSON logs sent to:
  - ELK Stack (Elasticsearch, Logstash, Kibana)
  - Datadog / New Relic
  - AWS CloudWatch / Google Cloud Logging
  - Loki/Promtail/Grafana

### Alerting Rules
Set up alerts for:
- Token refresh failures (consecutive 3 failures)
- Market feed worker downtime (> 5 minutes)
- Redis connection failures
- High memory usage (> 80% of allocated)
- API error rates (> 5% error rate)

## Migration Path

### From Current Direct Execution
1. **Phase 1**: Add environment variables to current deployment
2. **Phase 2**: Deploy token refresh service as cron job
3. **Phase 3**: Migrate market feed worker to chosen platform
4. **Phase 4**: Remove direct worker execution from main app
5. **Phase 5**: Implement monitoring and alerting

### Rollback Procedure
All deployment options support easy rollback:
- **Trigger.dev/Inngest**: Deploy previous version
- **Docker**: Rollback to previous image tag
- **PM2**: `pm2 restart <app> --update-env`
- **Celery**: Redeploy previous worker code

## Security Considerations

1. **Credential Management**:
   - Never commit `.env` files to version control
   - Use secret managers (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Rotate Angel One credentials regularly
   - Use least-privilege API keys

2. **Network Security**:
   - Restrict Redis access to trusted networks/IPs
   - Use TLS for all external API calls
   - Implement rate limiting on public endpoints
   - Use API gateways for authentication

3. **Data Protection**:
   - Encrypt sensitive data at rest (PAN data, user info)
   - Implement data retention policies
   - Regular security audits and penetration testing
   - GDPR/CCPA compliance for user data

## Testing Deployment

Before deploying to production:
1. Run local tests: `npm test`
2. Test token refresh service manually
3. Validate market feed worker connects and publishes ticks
4. Verify Redis pub/sub and SSE streaming works
5. Check all API endpoints return expected responses
6. Test fallback scenarios (missing credentials, network issues)
7. Validate logging and error handling

## Troubleshooting

### Common Issues
1. **Token Refresh Failures**:
   - Check Angel One credentials are valid
   - Verify network connectivity to Angel One API
   - Ensure Redis is accessible for caching

2. **Market Feed Worker Disconnections**:
   - Check WebSocket connection limits
   - Verify Angel One feed token permissions
   - Monitor Redis memory usage

3. **Redis Connection Issues**:
   - Verify Redis URL format and credentials
   - Check network connectivity to Redis instance
   - Ensure sufficient Redis memory allocation

4. **Next.js Application Issues**:
   - Verify Node.js version compatibility
   - Check build output for TypeScript errors
   - Confirm environment variables are loaded correctly

### Debug Commands
```bash
# Check Redis connection
redis-cli -u $UPSTASH_REDIS_URL ping

# Test Angel One API connectivity
curl -H "Authorization: Bearer $ANGEL_ONE_JWT_TOKEN" \
  https://apiconnect.angelbroking.com/rest/secure/angelbroking/validate

# View recent logs (Docker)
docker-compose logs --tail=100 [service-name]

# Check worker status (PM2)
pm2 list
pm2 show <app-name>
```