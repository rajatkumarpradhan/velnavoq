-- Approved source history only. No artifact, build, deployment or live-release success is inferred.
CREATE TABLE source_revisions(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,revision INTEGER NOT NULL,digest TEXT NOT NULL,bundle_json TEXT NOT NULL,proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(id),approved_by TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,PRIMARY KEY(project_id,revision));
CREATE TRIGGER source_revision_immutable_update BEFORE UPDATE ON source_revisions BEGIN SELECT RAISE(ABORT,'immutable_source_revision'); END;
CREATE TRIGGER record_source_revision AFTER UPDATE OF status ON proposals WHEN NEW.status='approved' BEGIN
 INSERT INTO source_revisions(project_id,revision,digest,bundle_json,proposal_id,approved_by,created_at) SELECT id,revision,NEW.digest,NEW.bundle_json,NEW.id,NEW.approved_by,NEW.decided_at FROM projects WHERE id=NEW.project_id;
END;
