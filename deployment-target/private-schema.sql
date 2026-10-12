CREATE TABLE IF NOT EXISTS target_app_users(project_id TEXT NOT NULL,id TEXT NOT NULL,email TEXT NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,id),UNIQUE(project_id,email));
CREATE TABLE IF NOT EXISTS target_app_sessions(project_id TEXT NOT NULL,token_hash TEXT NOT NULL,user_id TEXT NOT NULL,csrf_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,token_hash),FOREIGN KEY(project_id,user_id) REFERENCES target_app_users(project_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS target_app_session_expiry ON target_app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS target_app_rows(project_id TEXT NOT NULL,table_name TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,table_name,id),FOREIGN KEY(project_id,user_id) REFERENCES target_app_users(project_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS target_app_row_owner ON target_app_rows(project_id,user_id,table_name,id);
CREATE TRIGGER IF NOT EXISTS target_app_row_identity BEFORE UPDATE OF project_id,table_name,id,user_id,created_at ON target_app_rows BEGIN SELECT RAISE(ABORT,'immutable_app_row_identity'); END;
CREATE TABLE IF NOT EXISTS target_app_auth_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
