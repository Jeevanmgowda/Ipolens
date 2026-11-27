import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Automatically load .env.local if present
const envLocalPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Tests must never read or write the real Supabase database or Redis from .env.local.
// Set ALLOW_LIVE_DB_TESTS=true explicitly to opt in.
if (process.env.ALLOW_LIVE_DB_TESTS !== 'true') {
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'UPSTASH_REDIS_URL', 'REDIS_URL']) {
    delete process.env[key];
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    // Only run tests in the main tests/ directory
    include: ['tests/*.test.ts'],
    // Exclude worktree test directories
    exclude: ['.claude/**', 'node_modules/**', 'dist/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['.claude/**', 'node_modules/**', '.next/**', 'workers/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});