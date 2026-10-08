-- Workspace ownership is the project ownership boundary. Creator is provenance, not an authorization bypass.
ALTER TABLE projects ADD COLUMN created_by TEXT REFERENCES users(id);
CREATE TRIGGER preserve_last_owner_delete BEFORE DELETE ON memberships WHEN OLD.role='owner' AND (SELECT COUNT(*) FROM memberships WHERE workspace_id=OLD.workspace_id AND role='owner')<=1 BEGIN SELECT RAISE(ABORT,'last_owner_required'); END;
CREATE TRIGGER preserve_last_owner_update BEFORE UPDATE OF role ON memberships WHEN OLD.role='owner' AND NEW.role<>'owner' AND (SELECT COUNT(*) FROM memberships WHERE workspace_id=OLD.workspace_id AND role='owner')<=1 BEGIN SELECT RAISE(ABORT,'last_owner_required'); END;
