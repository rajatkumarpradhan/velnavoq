-- Pending email ownership proofs only. Never changes an existing account on migration.
CREATE TABLE account_email_changes(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,old_email TEXT NOT NULL,new_email TEXT NOT NULL,password_hash TEXT NOT NULL,session_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,claim TEXT);
CREATE INDEX account_email_change_expiry ON account_email_changes(expires_at);

CREATE TABLE account_email_change_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,created_at INTEGER NOT NULL);
