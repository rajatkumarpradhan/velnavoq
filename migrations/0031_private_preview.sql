-- Controller DB only. Additive; published app tables/data remain on target DB unchanged.
ALTER TABLE previews ADD COLUMN backend_config_json TEXT;
ALTER TABLE previews ADD COLUMN backend_digest TEXT;
CREATE TABLE IF NOT EXISTS preview_app_users(project_id TEXT NOT NULL REFERENCES previews(id) ON DELETE CASCADE,id TEXT NOT NULL,email TEXT NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,id),UNIQUE(project_id,email));
CREATE TABLE IF NOT EXISTS preview_app_sessions(project_id TEXT NOT NULL,token_hash TEXT NOT NULL,user_id TEXT NOT NULL,csrf_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,token_hash),FOREIGN KEY(project_id,user_id) REFERENCES preview_app_users(project_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS preview_app_session_expiry ON preview_app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS preview_app_rows(project_id TEXT NOT NULL,table_name TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,table_name,id),FOREIGN KEY(project_id,user_id) REFERENCES preview_app_users(project_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS preview_app_row_owner ON preview_app_rows(project_id,user_id,table_name,id);
CREATE TRIGGER IF NOT EXISTS preview_app_row_identity BEFORE UPDATE OF project_id,table_name,id,user_id,created_at ON preview_app_rows BEGIN SELECT RAISE(ABORT,'immutable_app_row_identity'); END;
CREATE TABLE IF NOT EXISTS preview_app_auth_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE TABLE preview_backend_rates(project_id TEXT NOT NULL,ip_hash TEXT NOT NULL,window INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(project_id,ip_hash,window));
CREATE TRIGGER preview_account_capacity BEFORE INSERT ON preview_app_users WHEN (SELECT count(*) FROM preview_app_users)>=1000 BEGIN SELECT RAISE(ABORT,'target_service_capacity'); END;
CREATE TRIGGER preview_row_capacity BEFORE INSERT ON preview_app_rows WHEN (SELECT count(*) FROM preview_app_rows)>=20000 BEGIN SELECT RAISE(ABORT,'target_service_capacity'); END;
CREATE TRIGGER preview_user_active BEFORE INSERT ON preview_app_users WHEN NOT EXISTS(SELECT 1 FROM previews WHERE id=NEW.project_id AND status NOT IN ('stopped','expired','timed_out') AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) BEGIN SELECT RAISE(ABORT,'preview_expired'); END;
CREATE TRIGGER preview_session_active BEFORE INSERT ON preview_app_sessions WHEN NOT EXISTS(SELECT 1 FROM previews WHERE id=NEW.project_id AND status NOT IN ('stopped','expired','timed_out') AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) BEGIN SELECT RAISE(ABORT,'preview_expired'); END;
CREATE TRIGGER preview_row_active BEFORE INSERT ON preview_app_rows WHEN NOT EXISTS(SELECT 1 FROM previews WHERE id=NEW.project_id AND status NOT IN ('stopped','expired','timed_out') AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) BEGIN SELECT RAISE(ABORT,'preview_expired'); END;
CREATE TRIGGER preview_row_update_active BEFORE UPDATE ON preview_app_rows WHEN NOT EXISTS(SELECT 1 FROM previews WHERE id=NEW.project_id AND status NOT IN ('stopped','expired','timed_out') AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) BEGIN SELECT RAISE(ABORT,'preview_expired'); END;
