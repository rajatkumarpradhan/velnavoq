-- Guard ensures password update won the old-hash race before any session revocation commits.
CREATE TABLE password_change_guard(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,expected_hash TEXT NOT NULL);
CREATE TRIGGER password_change_guard_check BEFORE INSERT ON password_change_guard WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND password_hash=NEW.expected_hash) BEGIN SELECT RAISE(ABORT,'password_change_conflict'); END;
CREATE TABLE oauth_code_tokens(consent_id TEXT NOT NULL REFERENCES mcp_consents(id) ON DELETE CASCADE,token_id TEXT NOT NULL UNIQUE REFERENCES mcp_access_tokens(id) ON DELETE CASCADE,PRIMARY KEY(consent_id,token_id));
CREATE TRIGGER oauth_code_token_no_update BEFORE UPDATE ON oauth_code_tokens BEGIN SELECT RAISE(ABORT,'immutable_code_token'); END;

CREATE TRIGGER oauth_code_token_gate BEFORE INSERT ON oauth_code_tokens WHEN NOT EXISTS(SELECT 1 FROM mcp_consents s JOIN mcp_access_tokens t ON t.id=NEW.token_id WHERE s.id=NEW.consent_id AND s.consumed_at IS NULL AND s.status='approved' AND s.expires_at>CAST(strftime('%s','now') AS INTEGER)*1000 AND s.client_id=t.client_id AND s.user_id=t.user_id AND s.resource=t.audience AND s.scopes=t.scopes) BEGIN SELECT RAISE(ABORT,'oauth_code_already_consumed_or_mismatch'); END;
