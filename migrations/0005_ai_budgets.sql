CREATE TABLE ai_budgets(project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,token_limit INTEGER NOT NULL CHECK(token_limit BETWEEN 0 AND 1000000),charged_tokens INTEGER NOT NULL DEFAULT 0 CHECK(charged_tokens>=0));
CREATE TABLE ai_requests(project_id TEXT NOT NULL REFERENCES ai_budgets(project_id) ON DELETE CASCADE,request_id TEXT NOT NULL,reserved_tokens INTEGER NOT NULL CHECK(reserved_tokens>0),input_tokens INTEGER,output_tokens INTEGER,status TEXT NOT NULL CHECK(status IN ('reserved','settled')),created_at INTEGER NOT NULL,PRIMARY KEY(project_id,request_id));
CREATE INDEX ai_requests_project_time ON ai_requests(project_id,created_at);
CREATE TRIGGER ai_reserve BEFORE INSERT ON ai_requests BEGIN
 SELECT CASE WHEN (SELECT charged_tokens+NEW.reserved_tokens>token_limit FROM ai_budgets WHERE project_id=NEW.project_id) THEN RAISE(ABORT,'budget_exceeded') END;
 UPDATE ai_budgets SET charged_tokens=charged_tokens+NEW.reserved_tokens WHERE project_id=NEW.project_id;
END;
CREATE TABLE ai_events(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,request_id TEXT NOT NULL,provider_id TEXT NOT NULL,model_id TEXT NOT NULL,attempt INTEGER NOT NULL,phase TEXT NOT NULL CHECK(phase IN ('start','done','error')),error_code TEXT,input_tokens INTEGER,output_tokens INTEGER,created_at INTEGER NOT NULL);
CREATE INDEX ai_events_project_time ON ai_events(project_id,created_at);
