-- Part 24: abuse and cost control. Counters are content-free (ids, metric names, numbers only).
-- Atomic consume uses INSERT ... ON CONFLICT DO UPDATE ... WHERE, so no trigger and no CASE is needed.
CREATE TABLE usage_counters(scope TEXT NOT NULL CHECK(scope IN ('user','workspace','project','global','account')),scope_id TEXT NOT NULL,metric TEXT NOT NULL,window_start INTEGER NOT NULL,count INTEGER NOT NULL CHECK(count>=0),PRIMARY KEY(scope,scope_id,metric,window_start));
CREATE INDEX usage_counters_window ON usage_counters(window_start);
CREATE TABLE quota_denials(id INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,scope_id TEXT NOT NULL,metric TEXT NOT NULL,user_id TEXT,created_at INTEGER NOT NULL);
CREATE INDEX quota_denials_user_time ON quota_denials(user_id,created_at);
CREATE TABLE abuse_cooldowns(user_id TEXT PRIMARY KEY,until INTEGER NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
