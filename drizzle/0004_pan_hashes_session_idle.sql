-- Security audit follow-up (docs/security/AUDIT_2026-11-27.md, M1/M8/L4).
-- pan_hash / primary_pan_hash: HMAC-SHA256 of the PAN, keyed from PAN_ENCRYPTION_KEY, for
-- ownership checks without storing PANs in plain text. They cannot be computed in SQL (the key
-- lives only in the app), so existing rows are backfilled lazily by the app: family PANs on the
-- first ownership check (decrypting pan_encrypted), and users.primary_pan on the next read, which
-- also replaces a legacy plain-text primary_pan with its masked form.
-- last_seen_at: drives the 24-hour idle timeout for sessions. Existing sessions start now.
-- The tables already have RLS enabled with no policies (0003), which covers the new columns.
ALTER TABLE "family_pans" ADD COLUMN "pan_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "last_seen_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "primary_pan_hash" varchar(64);