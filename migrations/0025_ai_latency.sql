ALTER TABLE agent_generation_sessions ADD COLUMN first_token_ms INTEGER;
ALTER TABLE agent_generation_sessions ADD COLUMN output_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_generation_sessions ADD COLUMN call_duration_ms INTEGER;
