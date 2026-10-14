-- Apply once only AFTER base schema.sql/backend-schema.sql/private-schema.sql, with backup.
-- Existing records are counted, never deleted. If already over cap, new/growing writes fail;
-- reads, deletions and shrinking edits remain possible. Limits are operator reviewed local defaults.
CREATE TABLE IF NOT EXISTS target_service_budget(metric TEXT PRIMARY KEY,used INTEGER NOT NULL CHECK(used>=0),capacity INTEGER NOT NULL CHECK(capacity>0));

INSERT OR IGNORE INTO target_service_budget VALUES('rows.count',(SELECT count(*) FROM target_backend_rows) + (SELECT count(*) FROM target_app_rows),50000);
INSERT OR IGNORE INTO target_service_budget VALUES('rows.bytes',(SELECT COALESCE(sum(length(CAST(data_json AS BLOB))),0) FROM target_backend_rows) + (SELECT COALESCE(sum(length(CAST(data_json AS BLOB))),0) FROM target_app_rows),67108864);
CREATE TRIGGER IF NOT EXISTS service_target_backend_rows_count_insert AFTER INSERT ON target_backend_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count') OR ((1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count' AND used+(1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(1) WHERE metric='rows.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_rows_count_delete AFTER DELETE ON target_backend_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count') OR ((-1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count' AND used+(-1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-1) WHERE metric='rows.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_rows_bytes_insert AFTER INSERT ON target_backend_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes') OR ((length(CAST(NEW.data_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes' AND used+(length(CAST(NEW.data_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.data_json AS BLOB))) WHERE metric='rows.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_rows_bytes_delete AFTER DELETE ON target_backend_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes') OR ((-length(CAST(OLD.data_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes' AND used+(-length(CAST(OLD.data_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-length(CAST(OLD.data_json AS BLOB))) WHERE metric='rows.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_rows_bytes_update AFTER UPDATE OF data_json ON target_backend_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes') OR ((length(CAST(NEW.data_json AS BLOB))-length(CAST(OLD.data_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes' AND used+(length(CAST(NEW.data_json AS BLOB))-length(CAST(OLD.data_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.data_json AS BLOB))-length(CAST(OLD.data_json AS BLOB))) WHERE metric='rows.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_rows_count_insert AFTER INSERT ON target_app_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count') OR ((1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count' AND used+(1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(1) WHERE metric='rows.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_rows_count_delete AFTER DELETE ON target_app_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count') OR ((-1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.count' AND used+(-1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-1) WHERE metric='rows.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_rows_bytes_insert AFTER INSERT ON target_app_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes') OR ((length(CAST(NEW.data_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes' AND used+(length(CAST(NEW.data_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.data_json AS BLOB))) WHERE metric='rows.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_rows_bytes_delete AFTER DELETE ON target_app_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes') OR ((-length(CAST(OLD.data_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes' AND used+(-length(CAST(OLD.data_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-length(CAST(OLD.data_json AS BLOB))) WHERE metric='rows.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_rows_bytes_update AFTER UPDATE OF data_json ON target_app_rows BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes') OR ((length(CAST(NEW.data_json AS BLOB))-length(CAST(OLD.data_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rows.bytes' AND used+(length(CAST(NEW.data_json AS BLOB))-length(CAST(OLD.data_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.data_json AS BLOB))-length(CAST(OLD.data_json AS BLOB))) WHERE metric='rows.bytes';
END;
INSERT OR IGNORE INTO target_service_budget VALUES('artifacts.count',(SELECT count(*) FROM target_artifacts),10000);
INSERT OR IGNORE INTO target_service_budget VALUES('artifacts.bytes',(SELECT COALESCE(sum(length(CAST(files_json AS BLOB))),0) FROM target_artifacts),67108864);
CREATE TRIGGER IF NOT EXISTS service_target_artifacts_count_insert AFTER INSERT ON target_artifacts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.count') OR ((1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.count' AND used+(1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(1) WHERE metric='artifacts.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_artifacts_count_delete AFTER DELETE ON target_artifacts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.count') OR ((-1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.count' AND used+(-1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-1) WHERE metric='artifacts.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_artifacts_bytes_insert AFTER INSERT ON target_artifacts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.bytes') OR ((length(CAST(NEW.files_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.bytes' AND used+(length(CAST(NEW.files_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.files_json AS BLOB))) WHERE metric='artifacts.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_artifacts_bytes_delete AFTER DELETE ON target_artifacts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.bytes') OR ((-length(CAST(OLD.files_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.bytes' AND used+(-length(CAST(OLD.files_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-length(CAST(OLD.files_json AS BLOB))) WHERE metric='artifacts.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_artifacts_bytes_update AFTER UPDATE OF files_json ON target_artifacts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.bytes') OR ((length(CAST(NEW.files_json AS BLOB))-length(CAST(OLD.files_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='artifacts.bytes' AND used+(length(CAST(NEW.files_json AS BLOB))-length(CAST(OLD.files_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.files_json AS BLOB))-length(CAST(OLD.files_json AS BLOB))) WHERE metric='artifacts.bytes';
END;
INSERT OR IGNORE INTO target_service_budget VALUES('accounts.count',(SELECT count(*) FROM target_app_users),10000);
CREATE TRIGGER IF NOT EXISTS service_target_app_users_count_insert AFTER INSERT ON target_app_users BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='accounts.count') OR ((1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='accounts.count' AND used+(1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(1) WHERE metric='accounts.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_users_count_delete AFTER DELETE ON target_app_users BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='accounts.count') OR ((-1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='accounts.count' AND used+(-1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-1) WHERE metric='accounts.count';
END;
INSERT OR IGNORE INTO target_service_budget VALUES('configs.count',(SELECT count(*) FROM target_backend_configs),1000);
INSERT OR IGNORE INTO target_service_budget VALUES('configs.bytes',(SELECT COALESCE(sum(length(CAST(config_json AS BLOB))),0) FROM target_backend_configs),8388608);
CREATE TRIGGER IF NOT EXISTS service_target_backend_configs_count_insert AFTER INSERT ON target_backend_configs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.count') OR ((1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.count' AND used+(1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(1) WHERE metric='configs.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_configs_count_delete AFTER DELETE ON target_backend_configs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.count') OR ((-1)>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.count' AND used+(-1)>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-1) WHERE metric='configs.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_configs_bytes_insert AFTER INSERT ON target_backend_configs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.bytes') OR ((length(CAST(NEW.config_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.bytes' AND used+(length(CAST(NEW.config_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.config_json AS BLOB))) WHERE metric='configs.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_configs_bytes_delete AFTER DELETE ON target_backend_configs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.bytes') OR ((-length(CAST(OLD.config_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.bytes' AND used+(-length(CAST(OLD.config_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(-length(CAST(OLD.config_json AS BLOB))) WHERE metric='configs.bytes';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_configs_bytes_update AFTER UPDATE OF config_json ON target_backend_configs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.bytes') OR ((length(CAST(NEW.config_json AS BLOB))-length(CAST(OLD.config_json AS BLOB)))>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='configs.bytes' AND used+(length(CAST(NEW.config_json AS BLOB))-length(CAST(OLD.config_json AS BLOB)))>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
 UPDATE target_service_budget SET used=used+(length(CAST(NEW.config_json AS BLOB))-length(CAST(OLD.config_json AS BLOB))) WHERE metric='configs.bytes';
END;
CREATE INDEX IF NOT EXISTS target_app_accounts_admission ON target_app_users(created_at);

INSERT OR IGNORE INTO target_service_budget VALUES('sessions.count',(SELECT count(*) FROM target_app_sessions),50000);
CREATE TRIGGER IF NOT EXISTS service_target_app_sessions_insert AFTER INSERT ON target_app_sessions BEGIN
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='sessions.count') OR (1>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='sessions.count' AND used+1>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
UPDATE target_service_budget SET used=used+1 WHERE metric='sessions.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_app_sessions_delete AFTER DELETE ON target_app_sessions BEGIN
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='sessions.count') OR (-1>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='sessions.count' AND used+-1>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
UPDATE target_service_budget SET used=used+-1 WHERE metric='sessions.count';
END;

INSERT OR IGNORE INTO target_service_budget VALUES('rates.count',(SELECT count(*) FROM target_backend_rates),20000);
CREATE TRIGGER IF NOT EXISTS service_target_backend_rates_insert AFTER INSERT ON target_backend_rates BEGIN
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rates.count') OR (1>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rates.count' AND used+1>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
UPDATE target_service_budget SET used=used+1 WHERE metric='rates.count';
END;
CREATE TRIGGER IF NOT EXISTS service_target_backend_rates_delete AFTER DELETE ON target_backend_rates BEGIN
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rates.count') OR (-1>0 AND EXISTS(SELECT 1 FROM target_service_budget WHERE metric='rates.count' AND used+-1>capacity)) THEN RAISE(ABORT,'target_service_capacity') END;
UPDATE target_service_budget SET used=used+-1 WHERE metric='rates.count';
END;
