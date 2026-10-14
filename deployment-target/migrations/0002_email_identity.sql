-- Additive, opt-in mail identity support; does not gate or invalidate existing accounts.
CREATE TABLE IF NOT EXISTS identity_mail_tokens(namespace TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('verify','recover')),token_hash TEXT NOT NULL,user_id TEXT NOT NULL,email TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,claim TEXT,PRIMARY KEY(namespace,kind,token_hash));
CREATE INDEX IF NOT EXISTS identity_mail_token_user ON identity_mail_tokens(namespace,user_id,kind);
CREATE INDEX IF NOT EXISTS identity_mail_token_expiry ON identity_mail_tokens(expires_at);
CREATE TABLE IF NOT EXISTS identity_email_verified(namespace TEXT NOT NULL,user_id TEXT NOT NULL,email TEXT NOT NULL,verified_at INTEGER NOT NULL,PRIMARY KEY(namespace,user_id));
CREATE TABLE IF NOT EXISTS identity_mail_rates(namespace TEXT NOT NULL,email_hash TEXT NOT NULL,window INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(namespace,email_hash,window));
