-- Security remediation (docs/security/BASELINE_AUDIT.md, M1 / N1).
-- Additive only: existing columns and data are untouched. Existing plain-text
-- users.primary_pan values are masked and hashed by the app the next time each
-- user is loaded (AuthStore.loadUserFromDatabase), because the HMAC key lives
-- in the app environment, not in the database.
ALTER TABLE family_pans ADD COLUMN IF NOT EXISTS pan_hash varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_pan_hash varchar(64);
CREATE INDEX IF NOT EXISTS family_pans_user_pan_hash_idx ON family_pans (user_id, pan_hash);
