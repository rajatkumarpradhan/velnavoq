-- Durable requirements only. Saving a request does not invoke an AI or grant any execution scope.
CREATE TABLE project_build_requests (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES users(id),
 instructions TEXT NOT NULL CHECK(length(instructions) BETWEEN 1 AND 4000),
 base_revision INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX build_request_project ON project_build_requests(project_id,created_at DESC,id DESC);
