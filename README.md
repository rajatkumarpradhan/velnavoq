# Velnavoq
by Drayvenn Lab

Fresh P0 control-plane implementation. Not a launched AI app builder.

## Actual code
- Workers TypeScript API, pinned dependencies and D1 migrations.
- Email/password authentication, salted PBKDF2-SHA256 (600,000 iterations), opaque hashed server sessions, exact-origin and CSRF checks, expiry/logout.
- Workspace/project create/list/read with owner/editor/viewer authorization.
- Immutable approved-source history stored transactionally, separate from a live deployment.
- Immutable static-web-v1 source proposals with canonical digests and base revision checks.
- Approval/rejection and idempotent retry. D1 triggers update approved source, revision and audit atomically. Tests inject an audit failure to prove rollback.
- Database-backed auth/write rate limits, body/filename/file-count/size limits, redacted internal errors.

## Reproduce
Node 22.23.3. `npm ci && npm run typecheck && npm run build && npm test`.
`npm run migrate:local` initializes local D1. `npm run dev` runs locally.
Password authentication is restricted to localhost and returns 503 on public origins. Production identity is blocked until a provider and Free-plan suitability are verified. Registration is disabled by default. To evaluate locally, set `REGISTRATION_ENABLED=true` in `.dev.vars`; never silently enable public signup.
The D1 ID in configuration is explicitly a local-only zero ID, not a claimed live resource. No deploy script is provided. `build` is a dry run only.

## NOT IMPLEMENTED / BLOCKED
- Isolated untrusted build/runtime, npm installs, arbitrary servers, deployed preview: BLOCKED by unverified free runtime. API returns 503; it never executes source.
- AI models, MCP/OAuth, editor/terminal, hosting, release rollback, production secret store, team invitations, email verification/recovery, project deletion and production backups: NOT IMPLEMENTED.
- No runtime or provider secrets are accepted or supplied to app bundles.
- Schema/permission changes are rejected, not faked. Only static HTML/CSS/JS/JSON/SVG/text source bundle storage is accepted; this is not a substitute for the eventual real runner.
- Registration/auth is locally tested, not public-production ready. Workers Free CPU budget with the required password KDF remains unverified. Production requires verified identity flow, abuse tests and safe invite/verification mechanism.
- No Cloudflare remote resources, domain, token, paid plan or external account created.
- API checks are not a complete OWASP ASVS audit. No mobile UI is yet implemented or visually verified.

See `DECISIONS.md` for dated sources and remaining gates.

Local SQLite backup/restore: `python3 scripts/check-backup.py` tests exact SQL equality, integrity, foreign keys and 0600 mode. `python3 scripts/backup-local.py SOURCE DESTINATION` refuses overwrite. This is local backup tooling, not encrypted remote disaster recovery.
