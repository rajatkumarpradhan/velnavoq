-- Explicit ongoing NEW consent uses -1, never a distant fabricated expiry.
-- No existing grants, clients, scopes or refresh families are extended.
DROP TRIGGER account_refresh_binding;
DROP TRIGGER account_refresh_entry_guard;
CREATE TRIGGER account_refresh_binding BEFORE INSERT ON account_mcp_refresh_families BEGIN
 SELECT RAISE(ABORT,'refresh_binding_denied') WHERE NOT EXISTS (
 SELECT 1 FROM account_mcp_tokens t JOIN account_mcp_code_tokens ct ON ct.token_id=t.id
 JOIN account_mcp_consents s ON s.id=ct.consent_id
 WHERE t.id=NEW.authorization_id AND t.client_id=NEW.client_id AND t.user_id=NEW.user_id
 AND t.revoked_at IS NULL AND s.renewable_until=NEW.grant_deadline_ms
 AND NEW.scopes_json=t.scopes AND (NEW.grant_deadline_ms=-1 OR
 (NEW.grant_deadline_ms>NEW.created_at AND NEW.grant_deadline_ms<=NEW.created_at+86400000))
 );
END;
CREATE TRIGGER account_refresh_entry_guard BEFORE INSERT ON account_mcp_refresh_entries BEGIN
 SELECT RAISE(ABORT,'refresh_changed_or_expired') WHERE NOT EXISTS (
 SELECT 1 FROM account_mcp_refresh_families f JOIN account_mcp_tokens t ON t.id=f.authorization_id
 WHERE f.id=NEW.family_id AND f.revoked_at IS NULL AND t.revoked_at IS NULL
 AND NEW.expires_at=f.grant_deadline_ms AND (NEW.expires_at=-1 OR NEW.created_at<NEW.expires_at)
 AND (NEW.predecessor_hash IS NULL OR EXISTS(SELECT 1 FROM account_mcp_refresh_entries p
 WHERE p.token_hash=NEW.predecessor_hash AND p.family_id=NEW.family_id AND p.consumed_at IS NULL))
 );
END;
