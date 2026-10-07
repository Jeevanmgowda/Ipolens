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