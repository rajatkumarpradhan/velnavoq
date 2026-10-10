ALTER TABLE account_mcp_clients ADD COLUMN redirect_uris_json TEXT;
ALTER TABLE account_mcp_consents ADD COLUMN redirect_uri TEXT;
UPDATE account_mcp_clients SET redirect_uris_json=json_array(redirect_uri);
UPDATE account_mcp_consents SET redirect_uri=(SELECT redirect_uri FROM account_mcp_clients WHERE id=client_id);
CREATE TRIGGER account_consent_redirect_immutable BEFORE UPDATE OF redirect_uri ON account_mcp_consents BEGIN SELECT RAISE(ABORT,'consent_redirect_immutable'); END;
