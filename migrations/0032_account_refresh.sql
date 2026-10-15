-- New consent only. Existing authorizations remain untouched and non-renewable.
ALTER TABLE account_mcp_consents ADD COLUMN renewable_until INTEGER NOT NULL DEFAULT 0;
CREATE TABLE account_mcp_refresh_families (
 id TEXT PRIMARY KEY,
 authorization_id TEXT NOT NULL UNIQUE REFERENCES account_mcp_tokens(id),
 client_id TEXT NOT NULL REFERENCES account_mcp_clients(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 resource TEXT NOT NULL,
 scopes_json TEXT NOT NULL,
 grant_deadline_ms INTEGER NOT NULL,
 revoked_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE TABLE account_mcp_refresh_entries (
 token_hash TEXT PRIMARY KEY,
 family_id TEXT NOT NULL REFERENCES account_mcp_refresh_families(id),
 predecessor_hash TEXT UNIQUE REFERENCES account_mcp_refresh_entries(token_hash),
 consumed_at INTEGER,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX account_refresh_family ON account_mcp_refresh_entries(family_id);
CREATE TRIGGER account_refresh_binding BEFORE INSERT ON account_mcp_refresh_families BEGIN
 SELECT RAISE(ABORT,'refresh_binding_denied') WHERE NOT EXISTS (
 SELECT 1 FROM account_mcp_tokens t JOIN account_mcp_code_tokens ct ON ct.token_id=t.id
 JOIN account_mcp_consents s ON s.id=ct.consent_id
 WHERE t.id=NEW.authorization_id AND t.client_id=NEW.client_id AND t.user_id=NEW.user_id
 AND t.revoked_at IS NULL AND s.renewable_until=NEW.grant_deadline_ms
 AND NEW.scopes_json=t.scopes AND NEW.grant_deadline_ms>NEW.created_at
 AND NEW.grant_deadline_ms<=NEW.created_at+86400000
 );
END;
CREATE TRIGGER account_refresh_entry_guard BEFORE INSERT ON account_mcp_refresh_entries BEGIN
 SELECT RAISE(ABORT,'refresh_changed_or_expired') WHERE NOT EXISTS (
 SELECT 1 FROM account_mcp_refresh_families f JOIN account_mcp_tokens t ON t.id=f.authorization_id
 WHERE f.id=NEW.family_id AND f.revoked_at IS NULL AND t.revoked_at IS NULL
 AND NEW.expires_at=f.grant_deadline_ms AND NEW.created_at<NEW.expires_at
 AND (NEW.predecessor_hash IS NULL OR EXISTS(SELECT 1 FROM account_mcp_refresh_entries p
 WHERE p.token_hash=NEW.predecessor_hash AND p.family_id=NEW.family_id AND p.consumed_at IS NULL))
 );
END;
CREATE TRIGGER account_refresh_consume AFTER INSERT ON account_mcp_refresh_entries
WHEN NEW.predecessor_hash IS NOT NULL BEGIN
 UPDATE account_mcp_refresh_entries SET consumed_at=NEW.created_at WHERE token_hash=NEW.predecessor_hash;
END;
CREATE TRIGGER account_refresh_family_immutable BEFORE UPDATE ON account_mcp_refresh_families
WHEN NEW.id!=OLD.id OR NEW.authorization_id!=OLD.authorization_id OR NEW.client_id!=OLD.client_id
 OR NEW.user_id!=OLD.user_id OR NEW.resource!=OLD.resource OR NEW.scopes_json!=OLD.scopes_json
 OR NEW.grant_deadline_ms!=OLD.grant_deadline_ms OR NEW.created_at!=OLD.created_at
 OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN SELECT RAISE(ABORT,'refresh_family_immutable'); END;
CREATE TRIGGER account_refresh_root_revoke AFTER UPDATE OF revoked_at ON account_mcp_tokens
WHEN NEW.revoked_at IS NOT NULL BEGIN
 UPDATE account_mcp_refresh_families SET revoked_at=NEW.revoked_at WHERE authorization_id=NEW.id AND revoked_at IS NULL;
END;
CREATE TRIGGER account_refresh_family_revoke AFTER UPDATE OF revoked_at ON account_mcp_refresh_families
WHEN NEW.revoked_at IS NOT NULL BEGIN
 UPDATE account_mcp_tokens SET revoked_at=NEW.revoked_at WHERE id=NEW.authorization_id AND revoked_at IS NULL;
END;
