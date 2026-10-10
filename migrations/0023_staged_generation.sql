CREATE TABLE agent_generation_sessions (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 instructions TEXT NOT NULL,
 plan_json TEXT NOT NULL DEFAULT '[]',
 next_file INTEGER NOT NULL DEFAULT 0,
 phase TEXT NOT NULL DEFAULT 'plan',
 proposal_id TEXT,
 expected_revision INTEGER NOT NULL,
 expected_digest TEXT NOT NULL,
 error_code TEXT,
 lock_id TEXT,
 lock_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX agent_generation_project ON agent_generation_sessions(project_id,user_id,updated_at);
