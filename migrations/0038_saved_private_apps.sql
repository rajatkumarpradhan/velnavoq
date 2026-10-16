-- Durable owner-only private apps, separate from ephemeral preview and public target data. No backfill or grant changes.
CREATE TABLE IF NOT EXISTS saved_app_users(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,id TEXT NOT NULL,email TEXT NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,id),UNIQUE(project_id,email));
CREATE TABLE IF NOT EXISTS saved_app_sessions(project_id TEXT NOT NULL,token_hash TEXT NOT NULL,user_id TEXT NOT NULL,csrf_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,token_hash),FOREIGN KEY(project_id,user_id) REFERENCES saved_app_users(project_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS saved_app_session_expiry ON saved_app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS saved_app_rows(project_id TEXT NOT NULL,table_name TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,table_name,id),FOREIGN KEY(project_id,user_id) REFERENCES saved_app_users(project_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS saved_app_row_owner ON saved_app_rows(project_id,user_id,table_name,id);
CREATE TRIGGER IF NOT EXISTS saved_app_row_identity BEFORE UPDATE OF project_id,table_name,id,user_id,created_at ON saved_app_rows BEGIN SELECT RAISE(ABORT,'immutable_app_row_identity'); END;
CREATE TABLE IF NOT EXISTS saved_app_auth_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_app_roles(project_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role='admin'),created_at INTEGER NOT NULL,PRIMARY KEY(project_id,user_id),FOREIGN KEY(project_id,user_id) REFERENCES saved_app_users(project_id,id) ON DELETE CASCADE);

CREATE TABLE saved_backend_rates(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,ip_hash TEXT NOT NULL,window INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(project_id,ip_hash,window));
CREATE TABLE saved_backend_rows(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,table_name TEXT NOT NULL,id TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,table_name,id));
CREATE TRIGGER saved_account_capacity BEFORE INSERT ON saved_app_users WHEN (SELECT count(*) FROM saved_app_users WHERE project_id=NEW.project_id)>=100 BEGIN SELECT RAISE(ABORT,'target_service_capacity'); END;
CREATE TRIGGER saved_row_capacity BEFORE INSERT ON saved_app_rows WHEN (SELECT count(*) FROM saved_app_rows WHERE project_id=NEW.project_id)>=20000 BEGIN SELECT RAISE(ABORT,'target_service_capacity'); END;
CREATE TRIGGER saved_shared_capacity BEFORE INSERT ON saved_backend_rows WHEN (SELECT count(*) FROM saved_backend_rows WHERE project_id=NEW.project_id)>=20000 BEGIN SELECT RAISE(ABORT,'target_service_capacity'); END;
