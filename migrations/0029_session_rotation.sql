CREATE TABLE session_rotation_aliases(old_hash TEXT PRIMARY KEY,new_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE ON UPDATE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX session_alias_expiry ON session_rotation_aliases(expires_at);
UPDATE sessions SET expires_at=CAST(strftime('%s','now') AS INTEGER)+2592000 WHERE expires_at>CAST(strftime('%s','now') AS INTEGER);
