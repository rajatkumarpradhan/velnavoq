CREATE TABLE target_artifacts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,digest TEXT NOT NULL,files_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TRIGGER target_immutable BEFORE UPDATE ON target_artifacts BEGIN SELECT RAISE(ABORT,'immutable_target_artifact'); END;
