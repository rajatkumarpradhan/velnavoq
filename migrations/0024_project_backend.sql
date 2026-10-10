CREATE TABLE backend_proposals(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES users(id),config_json TEXT NOT NULL,digest TEXT NOT NULL,base_digest TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,approved_by TEXT,decided_at INTEGER);
CREATE TABLE project_backends(project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,config_json TEXT NOT NULL,digest TEXT NOT NULL,approved_by TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE backend_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,digest TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE mcp_pending_clients(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL,redirect_uri TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TRIGGER backend_proposal_immutable BEFORE UPDATE OF project_id,author_id,config_json,digest,base_digest ON backend_proposals BEGIN SELECT RAISE(ABORT,'immutable_backend_proposal'); END;
CREATE TRIGGER backend_approval_gate BEFORE UPDATE OF status ON backend_proposals WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN OLD.status<>'pending' OR NOT EXISTS(SELECT 1 FROM projects p JOIN memberships m ON m.workspace_id=p.workspace_id WHERE p.id=NEW.project_id AND m.user_id=NEW.approved_by AND m.role='owner') THEN RAISE(ABORT,'backend_owner_required') END;
 SELECT CASE WHEN COALESCE((SELECT digest FROM project_backends WHERE project_id=NEW.project_id),'')<>COALESCE(NEW.base_digest,'') THEN RAISE(ABORT,'backend_stale_schema') END;
 INSERT INTO project_backends VALUES(NEW.project_id,NEW.config_json,NEW.digest,NEW.approved_by,NEW.decided_at) ON CONFLICT(project_id) DO UPDATE SET config_json=excluded.config_json,digest=excluded.digest,approved_by=excluded.approved_by,updated_at=excluded.updated_at;
END;
CREATE TABLE backend_activations(project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,release_id TEXT NOT NULL,digest TEXT NOT NULL,url TEXT NOT NULL,activated_at INTEGER NOT NULL);
ALTER TABLE mcp_sandbox_grants ADD COLUMN backend_digest TEXT;
