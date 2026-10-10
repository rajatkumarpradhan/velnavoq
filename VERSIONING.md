# Project versioning

Part 17 source implementation. Local Worker/D1 tests only. The public control plane is not deployed. No remote Git connector, branch, merge or GitHub push is implemented in the product.

## Snapshots and change history

Every approved source save creates a numbered, immutable source revision with a canonical SHA-256 digest, exact bundle, proposal ID, approving user and timestamp. A new project starts at revision 0 with no approved snapshot. Version numbers begin at 1. Historical snapshots are read-only, rehashed before use and shown as untrusted text, never executed.

The history endpoint lists the latest 100 versions and 100 proposals with base revision, bundle digest, author, decision and timestamps. Structured AI proposals retain their immutable patch digest and source digest. Applied versions link back to those proposals. This records accepted modifications, not proof of which model authored text copied manually into the editor. It does not invent provider/model provenance.

Diff requires two explicit version numbers. It returns exact added, removed and modified files, before/after source, both digests, and schema/permission pairs. Static-web-v1 still rejects unsupported nonempty schema and permissions. Existing file count, size and bundle limits bound each snapshot; history lists are bounded, not full-history pagination. Any valid older version can still be loaded directly by number.

## Restore and rollback

Select the exact target version and digest against the current base revision. Restore and rollback create a pending immutable proposal, not a source change. Rollback requires an older version. The review manifest includes target version, digest and operation. The owner reviews actual before/after source, acknowledges risk, and separately confirms destructive changes through the existing exact-review screen.

Approval creates a new forward revision containing the target snapshot. It never rewrites the old revision or silently moves a release. Rejection/cancellation leave source unchanged. A stale base revision fails closed. Concurrent decisions commit once; a later audit failure rolls the whole source/decision transaction back. Database validation rejects mismatched restoration lineage. Known registered environment values are checked before restoring, just as on other source mutations. Unknown, obfuscated or retired secrets are not universally detectable.

## Release and deployment versions

A source release pins an explicit approved version and matching digest with an owner label and timestamp. The chosen version can be older than the current revision. It is source-only: no build, artifact trust, published URL or deployment is implied. The release write checks the displayed current base revision atomically, preventing a concurrent source save from silently changing the reviewed state.

A deployment request must name a pinned source release plus its exact version and digest. Missing or mismatched values are rejected. A valid request records an immutable blocked intent and returns HTTP 503, `hosted_deployment_not_configured`, `deployed:false`. No mutable workspace is deployed. No live deployment rollback, routing change, data migration compensation or health check is claimed. The rollback implemented here is source rollback, followed by separate review.

Earlier artifact/job/release/deployment metadata already has foreign-key lineage; update guards now stop that chain being repointed. Browser build receipts remain untrusted and are not promoted to trusted release evidence.

## API

All paths start with `/api/projects/:projectId/versioning/`.

- `GET history`, `GET snapshot/:version`, `GET diff?from=1&to=2`
- `GET releases`, `GET deployments`
- `POST restore` or `rollback`: `baseRevision`, `targetVersion`, `targetDigest`
- `POST releases`: `baseRevision`, `version`, `sourceDigest`, `label`
- `POST deployments`: `releaseId`, `version`, `sourceDigest`

Reads require project membership; writes require owner, exact Origin/CSRF and existing rate limits. Restore decisions use the existing `/api/proposals/:id/review` and `/decision` flow. No new API secrets or payment services are required.

## Verification and limits

`npm run check`, `npm run ui:build`, `node scripts/versioning-check.mjs`, and `python3 scripts/check-backup.py` reproduce local tests. The browser test runs the real local Worker/D1, selects v1 against current v2, pins that explicit source release, proposes rollback without changing source, reviews it, and proves v3 equals v1 while v2 remains intact. Layout and accessibility checks cover 360/390/412/1440 CSS pixels, not physical OnePlus or Safari performance.

Database update guards are not signed or admin-proof WORM storage. A database administrator can alter tables/triggers. Project deletion still removes source snapshots/releases/lineage; the separate decision/review audit survives under Part 15. Local SQL/binary backup restore is tested; no production encrypted remote disaster recovery or retention guarantee exists. Hosted deployment, production identity and server encryption-key custody remain unconfigured. Nothing spent, no paid plans, cards, model keys, R2, domain or account-security changes.
