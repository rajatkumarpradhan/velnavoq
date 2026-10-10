CREATE TABLE IF NOT EXISTS target_backend_configs(project_id TEXT PRIMARY KEY,config_json TEXT NOT NULL,digest TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS target_backend_rows(project_id TEXT NOT NULL,table_name TEXT NOT NULL,id TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(project_id,table_name,id));
CREATE TABLE IF NOT EXISTS target_backend_rates(project_id TEXT NOT NULL,ip_hash TEXT NOT NULL,window INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(project_id,ip_hash,window));
CREATE TABLE IF NOT EXISTS target_current(project_id TEXT PRIMARY KEY,artifact_id TEXT NOT NULL);
