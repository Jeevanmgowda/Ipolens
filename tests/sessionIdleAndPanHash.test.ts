import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { createSession, validateSession, SESSION_IDLE_TIMEOUT_MS } from '@/lib/security/session';
import { schema } from '@/db';
import { secureLegacyPrimaryPan, getPrimaryPanHash, registeredUsersStore, registerOrLoginWithGoogle } from '@/services/authStore';
import { hashPanForLookup } from '@/lib/security/panEncryption';

/**
 * Follow-up to docs/security/AUDIT_2026-11-27.md (L4 idle timeout, M1/M8 PAN hashes),
 * added once the Supabase schema landed on main: migration 0004.
 */

const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
  for (let i = registeredUsersStore.length - 1; i >= 0; i--) {
    if (registeredUsersStore[i].email.endsWith('@idle-hash.test')) registeredUsersStore.splice(i, 1);
  }
});

describe('L4: session idle timeout', () => {
  it('revokes a session unused for longer than 24 hours, even before it expires', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-28T00:00:00Z') });
    const { token } = await createSession('usr_idle_1', true); // 30-day session
    vi.setSystemTime(Date.now() + SESSION_IDLE_TIMEOUT_MS + HOUR);
    expect(await validateSession(token)).toBeNull();
    // Revoked, not just rejected: activity afterwards does not bring it back.
    vi.setSystemTime(Date.now() + 1000);
    expect(await validateSession(token)).toBeNull();
  });

  it('keeps an active session alive past 24 hours of total age', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-28T00:00:00Z') });
    const { token } = await createSession('usr_idle_2', true);
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(Date.now() + 23 * HOUR);
      expect(await validateSession(token)).toBe('usr_idle_2');
    }
  });

  it('is 24 hours', () => {
    expect(SESSION_IDLE_TIMEOUT_MS).toBe(24 * HOUR);
  });
});

describe('Migration 0004: PAN hash and last-seen columns', () => {
  const columns = (table: Parameters<typeof getTableConfig>[0]) => getTableConfig(table).columns.map((c) => c.name);

  it('adds the columns to the Drizzle schema', () => {
    expect(columns(schema.familyPansTable)).toContain('pan_hash');
    expect(columns(schema.usersTable)).toContain('primary_pan_hash');
    expect(columns(schema.sessionsTable)).toContain('last_seen_at');
  });

  it('ships a migration that adds exactly those columns', () => {
    const dir = path.resolve(__dirname, '../drizzle');
    const sql = fs.readFileSync(path.join(dir, '0004_pan_hashes_session_idle.sql'), 'utf8');
    expect(sql).toMatch(/ALTER TABLE "family_pans" ADD COLUMN "pan_hash" varchar\(64\)/);
    expect(sql).toMatch(/ALTER TABLE "users" ADD COLUMN "primary_pan_hash" varchar\(64\)/);
    expect(sql).toMatch(/ALTER TABLE "user_sessions" ADD COLUMN "last_seen_at" timestamp DEFAULT now\(\) NOT NULL/);
    expect(sql).not.toMatch(/DROP|ALTER COLUMN/i);
    const journal = JSON.parse(fs.readFileSync(path.join(dir, 'meta/_journal.json'), 'utf8'));
    expect(journal.entries.map((e: { tag: string }) => e.tag)).toContain('0004_pan_hashes_session_idle');
  });
});

describe('M8: legacy plain-text primary PANs are secured on read', () => {
  it('masks a raw PAN and derives its lookup hash', async () => {
    const secured = await secureLegacyPrimaryPan('usr_legacy', 'LEGCY1234Z');
    expect(secured.primaryPan).toBe('LEGCY****Z');
    expect(secured.primaryPanHash).toBe(hashPanForLookup('LEGCY1234Z'));
  });

  it('leaves an already-masked value alone', async () => {
    const secured = await secureLegacyPrimaryPan('usr_legacy', 'LEGCY****Z');
    expect(secured.primaryPan).toBe('LEGCY****Z');
    expect(secured.primaryPanHash).toBeUndefined();
  });

  it('getPrimaryPanHash returns the stored hash for in-memory accounts', async () => {
    const result = registerOrLoginWithGoogle({ email: 'hash.user@idle-hash.test', name: 'Hash', primaryPan: 'HASHU1234Q' });
    expect(await getPrimaryPanHash(result.user!.id)).toBe(hashPanForLookup('HASHU1234Q'));
    expect(await getPrimaryPanHash('usr_unknown')).toBeUndefined();
  });
});
