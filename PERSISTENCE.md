# Part 6: database and real source persistence
Velnavoq by Drayvenn Lab | 9 October 2026

## Implemented
Migration 0004 adds normalized project_versions, files, file_versions, approvals and metadata schemas for jobs, job_events, artifacts, releases, deployments, environment_variables, secrets_metadata, mcp_connections and mcp_permissions. Existing users/sessions/workspaces/memberships/projects/proposals/audit remain. Real approval transactions populate file/version rows. Existing approved history is backfilled during migration; no invented creator or service records. Approved snapshots are immutable. Current files use the project's current revision, not a mutable path that overwrites history. Removed files disappear from the new snapshot but remain readable in old versions.

Authenticated `GET /api/projects/:id/files[/version]`, `/versions` and `/export[/version]` return actual persisted source. A source export can be submitted through the existing version-bound proposal/approval flow; no unsafe direct overwrite/import endpoint. Exports are not a full database backup. No job executor, artifact bucket, release publisher, secret store or MCP connector is activated just because its metadata schema exists.

## Relationships, indexes and deletion
- Workspace -> membership/project. User -> session and membership. Project creator is provenance. Last-owner database protection retained.
- Project -> project_versions -> file_versions. Files identify paths within a project; each file_version contains bounded text and UTF-8 byte count. Compound snapshot index `(project_id,version,path)` serves reads. Each version binds one exact proposal/digest and approval actor.
- Project -> proposal -> approval. Both reject and approve create an immutable decision record. Proposal snapshots retain compatibility JSON while normalized storage is introduced. This bounded duplication has a migration/storage cost and is not the eventual large-file/blob store.
- Project -> job -> job_events. Events use `(job_id,sequence)` primary key and a 16KB per-event cap. Project/time indexes serve job and deployment history. Job references a project_version.
- Artifact -> job with composite project/job foreign key. Artifact has key/digest/size metadata only, never artifact bytes. Release -> same-project artifact; deployment -> same-project release. Composite foreign keys stop cross-project associations.
- Environment variables contain only small non-secret values (4KB cap); secrets_metadata contains private-store reference/rotation metadata, no plaintext secret value. No API currently writes either.
- MCP connection -> permission, with granted actor/expiry and a checked operation. Credential reference only, no token storage.
- Project deletion cascades versions/files/proposals/approvals/jobs/events/artifacts/releases/deployments/env/secret/MCP metadata. Workspace-owned audit is retained after project deletion; it deliberately has no project foreign-key cascade. Object deletion is NOT implied by metadata deletion; future bucket deletion must be a verified cleanup workflow. User actor/history references prevent casual user deletion; there is no user/workspace hard-delete endpoint in this part.

## Transactions and bounded storage
Proposal decision UPDATE triggers atomic source revision, project version/file snapshot, approval and audit insertion. A failure anywhere rolls all back. Workspace creation+owner membership, membership change+audit and project deletion+audit are D1 batch transaction boundaries. File content enters only through strict allowed-file/path/bundle validation: 50 files and 500,000 aggregate UTF-8 bytes; arbitrary huge artifacts are never placed in SQL. SQL file content adds 500,000 byte per-row check. Missing/unauthorized project/version is 404; authorization is checked before persistence reads. Reads select one immutable version, so a concurrent approval cannot mix files from two versions.

## Research and decisions
Official sources inspected:
- https://developers.cloudflare.com/d1/platform/limits/ : Free database/storage/query limits must constrain retention, not be assumed unlimited.
- https://developers.cloudflare.com/d1/worker-api/d1-database/ : batch calls execute transactionally and roll back on failure.
- https://developers.cloudflare.com/d1/best-practices/export-import/ : SQL export/import mechanics and restore considerations.
- https://developers.cloudflare.com/r2/pricing/ : free usage allowances are not proof of activation entitlement.

Use indexed immutable normalized small source rows now rather than unbounded SQL blobs for build artifacts. Keep existing source/proposal JSON for compatibility and exact digest checks, with explicit duplication rather than silently destructive migration. Artifact object storage remains BLOCKED pending user-approved, free-verified activation. No R2 account/bucket or card was activated.

## Backup/export and restore
`python3 scripts/backup-local.py SOURCE DESTINATION`: SQLite consistent backup API from read-only source, integrity and foreign-key check, restrictive 0600 output, SHA256; refuses an existing destination. Do not commit backups, session hashes, emails or source exports. Local disk backup is not cloud disaster recovery.
`python3 scripts/check-backup.py`: upgrades a populated Part 5 database through migration 0004, populates all relationships only as isolated test metadata, binary backup/restore and SQL export/import, exact dump equivalence, integrity/foreign keys/file mode, then checks restored immutable/last-owner triggers and full project deletion cascades. Test output is temporary. No fake execution records enter the application.
Production strategy when D1 is connected: restricted SQL exports plus provider point-in-time recovery within its verified retention; restore into a separate database, check integrity/row counts/schema and application read/write/authorization, then approve cutover. Object-store backups/manifests and orphan cleanup remain blocked with object storage. No scheduled cloud backups or retention promise without a live connected source.

## Actual checks and limits
83 backend tests pass (8 new source/version/export/isolation/rollback/cascade tests). Populated migration, exact binary + SQL restore and post-restore constraints pass. Fourth migration applied locally. Browser/layout regression and UI production build remain separate checks. This is a real persistence layer for the bounded source contract, not a claim of universal application-stack runtime or production database rollout.
