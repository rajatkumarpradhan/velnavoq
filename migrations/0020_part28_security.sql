PRAGMA foreign_keys = ON;
-- Part 28: MFA (TOTP), account recovery, idle session timeout.
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE mfa_enrollments(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,secret_enc TEXT NOT NULL,key_version TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','active')),last_step INTEGER NOT NULL DEFAULT -1,created_at INTEGER NOT NULL,activated_at INTEGER);
CREATE TABLE mfa_recovery_codes(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,code_hash TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,code_hash));
CREATE TABLE mfa_pending(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,attempts INTEGER NOT NULL DEFAULT 0,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX mfa_pending_expiry ON mfa_pending(expires_at);
CREATE TABLE recovery_requests(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX recovery_requests_expiry ON recovery_requests(expires_at);
CREATE TABLE recovery_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,email TEXT NOT NULL,token TEXT NOT NULL,created_at INTEGER NOT NULL);
