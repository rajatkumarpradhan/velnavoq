CREATE TABLE account_mcp_clients(id TEXT PRIMARY KEY,name TEXT NOT NULL,redirect_uri TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE account_mcp_consents(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES account_mcp_clients(id),user_id TEXT NOT NULL REFERENCES users(id),scopes TEXT NOT NULL,challenge TEXT NOT NULL,state TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',expires_at INTEGER NOT NULL,code_hash TEXT UNIQUE,consumed_at INTEGER,projects_json TEXT NOT NULL DEFAULT '[]',workspaces_json TEXT NOT NULL DEFAULT '[]');
CREATE TABLE account_mcp_tokens(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,client_id TEXT NOT NULL REFERENCES account_mcp_clients(id),user_id TEXT NOT NULL REFERENCES users(id),scopes TEXT NOT NULL,workspaces_json TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,created_at INTEGER NOT NULL);
CREATE TABLE account_mcp_projects(token_id TEXT NOT NULL REFERENCES account_mcp_tokens(id),project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,child_client_id TEXT NOT NULL REFERENCES mcp_clients(id),child_token_id TEXT NOT NULL REFERENCES mcp_access_tokens(id),PRIMARY KEY(token_id,project_id));
CREATE TABLE account_mcp_code_tokens(consent_id TEXT PRIMARY KEY REFERENCES account_mcp_consents(id),token_id TEXT NOT NULL REFERENCES account_mcp_tokens(id));
CREATE TRIGGER account_token_revoke AFTER UPDATE OF revoked_at ON account_mcp_tokens WHEN NEW.revoked_at IS NOT NULL BEGIN
 UPDATE mcp_access_tokens SET revoked_at=NEW.revoked_at WHERE id IN(SELECT child_token_id FROM account_mcp_projects WHERE token_id=NEW.id);
 UPDATE mcp_clients SET revoked_at=NEW.revoked_at WHERE id IN(SELECT child_client_id FROM account_mcp_projects WHERE token_id=NEW.id);
END;
CREATE TRIGGER account_project_grant_gate BEFORE INSERT ON account_mcp_projects BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM account_mcp_tokens t JOIN projects p ON p.id=NEW.project_id JOIN memberships m ON m.workspace_id=p.workspace_id AND m.user_id=t.user_id JOIN mcp_clients c ON c.id=NEW.child_client_id WHERE t.id=NEW.token_id AND t.revoked_at IS NULL AND t.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND m.role='owner' AND c.owner_id=t.user_id AND c.project_id=p.id) THEN RAISE(ABORT,'account_grant_denied') END;
END;
