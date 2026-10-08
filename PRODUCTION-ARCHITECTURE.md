# Velnavoq Part 2: production architecture contract
by Drayvenn Lab | 9 October 2026

This is the target architecture and an incremental code boundary, not a production-readiness certificate. Part 1's published entitlement decisions remain unchanged. Every component below distinguishes intended behavior from current implementation. No untrusted application code runs inside the control plane.

## System map
```
User -> browser application shell -> authenticated control API
                                 -> workspace / project / proposal / source revision (D1)
                                 -> AI adapter -> validated source proposal
                                 -> job coordinator -> queue -> per-job isolated runner
                                                      -> build/test logs + artifact
Artifact -> separate-origin preview -> review exact change -> source approval
Approved artifact -> deployment controller -> health evidence -> live release
MCP clients -> MCP transport + OAuth resource boundary -> same scoped domain API
```
The queue wakes work; D1 is authoritative for job status. A provider result, terminal text, queue acknowledgement or model statement is not proof of a successful build, preview or deployment. Deployment and runtime use separate credentials/services, never a general control-plane environment passed to app code.

## Ownership and permission hierarchy
User > membership in Workspace > Project > Job > Runtime > Artifact > Release.
This is a permission chain, not a single user's ownership of all workspace data. Users may belong to multiple workspaces; workspace membership is the tenant boundary. A project belongs to exactly one workspace. A job belongs to exactly one project and records its actor, source revision, idempotency key and deadline. A runtime belongs to one workspace/project/job tuple. Artifacts belong to that job/project and exact source digest. A release belongs to its project/workspace and one approved artifact; the referenced artifact/job must have the same project/workspace.

| Role/principal | Read | Draft/edit/propose | Run job | Approve | Publish/rollback | Membership/secrets/delete |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace owner | Yes | Yes | Yes, when runner available | Yes, exact digest/version | Separate explicit action with health/approval evidence | Separate confirmed action; never accidental removal of last owner |
| Editor | Yes | Yes | Yes, when runner available | No | No | No |
| Viewer | Yes, no raw secret values | No | No | No | No | No |
| Job runner | Job-scoped source/input only | Output as untrusted artifact | Assigned job only | No | No | No |
| AI adapter | Minimum project files needed | Returns patch proposal | No implicit shell authority | No | No | No |
| MCP access token | Intersection of token scopes and current membership | Only granted project/tool scope | Only explicit granted capability | No automatic approval | No automatic publish | No implicit secret access |
| Deployment controller | Approved release/artifact metadata | No source edit | Health/deploy tasks only | No | Scoped one project/release action | Only destination-specific credential proxy |

Every resource lookup traverses to project.workspace_id and checks current membership, not an ID prefix or stale token role. Role removal/revocation takes effect before a queued job starts and before output is released. A future cancel endpoint additionally checks job.actor_id for editor cancellation; owner can cancel workspace jobs. Capability grants do not enable a feature whose availability flag is false.

The existing DB column names release_digest/release_json in projects record approved source, not a published application. New source_revisions explicitly preserves immutable approved source history. Future deploy releases use distinct records. No source revision is labeled live, healthy or deployed.

## Component contracts
In the table, trusted means trusted platform code only; inputs and counterpart/provider outputs still require validation. All operational references are workspace-scoped unless explicitly public metadata.

| Component / state | Responsibility; inputs -> outputs | Trust and authentication/authorization | Failure behavior, ownership and scaling |
| --- | --- | --- | --- |
| Frontend / NOT IMPLEMENTED | Responsive shell/editor/review; user action + scoped API results -> accessible view, typed API request | Untrusted browser client. Local/prod session mechanism, CSRF for effects. No admin credentials/model keys. | Clear actual loading/error/empty state, no simulated jobs. Owns ephemeral view state; durable project state server-owned. Static asset distribution, bounded client memory. |
| Control plane / local implementation | Coordinate identity/workspaces/projects/proposals and guard side effects; validated request -> domain result/request ID | Trusted code, hostile inputs. Verify identity, exact origin/CSRF, membership, role and resource scope on each call. | Structured 4xx/5xx, redacted errors, no partial approval. D1 source of truth; Workers horizontally scale within published quotas. |
| API / local implementation | Versioned contracts and bounded JSON; routes -> status/body/security headers | Session plus server resource checks. Errors do not leak other tenants. | 401 unauthenticated, 404 inaccessible resource, 409 version/digest conflict, 413 size, 429 quota, 503 unavailable. No successful placeholder endpoint. Backpressure/body cap. |
| Authentication / local only | Login/session/expiry/logout; credentials -> opaque hashed session + CSRF token | Password evaluation restricted to localhost. Public auth fail-closed until provider setup. OIDC issuer/audience/state/nonce checks required later. | Generic errors, rate limits, revoked/expired sessions denied. User credential record separated from projects. Production recovery/invites are unresolved, not invented. |
| Workspace service / create/list local | Membership tenant boundary; owner/new name -> workspace and owner membership | Local authenticated creator; later membership changes owner-only plus review. | Atomic workspace+membership write. No partial orphan. Each workspace owns membership/policies; quota by tenant. |
| Project service / create/list/read local | Source metadata and revision; workspace/name -> project; project ID -> authorized state | Owner/editor create, all current members read. Ignore client ownership claims. | Deny missing membership, reject stale edits; archival/delete require confirmed policy. Project references workspace. Indexed D1 queries. |
| Database / local D1 | Users, sessions, membership, projects, immutable proposals/source snapshots, audit; prepared statements -> persisted rows | Trusted binding only, no generated SQL. Authz at domain boundary plus owner check inside approval trigger. | Transactions roll back, migration failure explicit. Metadata belongs to workspace, identities to user. Index scans/write limits monitored before scale. |
| Object storage / NOT ACTIVATED | Store content-addressed artifacts and approved immutable bundles; validated bytes -> private digest/key | Controller credentials only. Scoped signed URLs, private by default, checksum and content type. | Reject unauthorized/malicious/oversize content; staged uploads avoid dangling release. R2 subscription/account entitlement not accepted. Alternative artifact adapter, lifecycle retention per tenant. |
| Job system / NOT IMPLEMENTED | Durable queue/checkpoints/cancel/deadline; authenticated operation + source digest -> job/events | Trusted scheduler, untrusted payload. Recheck membership and assigned source; service credential scoped to one job. | Compare-and-swap lease, dedup, bounded retry, timeout/DLQ/reconciliation. At-least-once queue delivery never duplicates release. D1 authoritative; queue/DO optional based on capacity. |
| AI Gateway / NOT ACTIVATED | Optional cache/rate limit/retry/fallback telemetry; scoped sanitized provider request -> actual result | Private-code cache disabled, no secrets in prompt/logs, paid fallback forbidden. Gateway credential not app-visible. | Outer deadline, bounded attempts, quota errors; no silent purchase or provider substitution. Per-tenant budgets/log retention. Gateway is not authorization. |
| Model adapters / NOT IMPLEMENTED | Provider-neutral prompt/file patch contract; minimal authorized context -> validated patch or error | Treat model output hostile. Tools allowlisted, arguments schema checked, disclosure policy enforced. Model cannot approve changes. | Partial/malformed JSON rejected, cancellation and token limits, no fake response. Conversation belongs to project. Provider adapter can migrate without changing domain approval. |
| MCP boundary / NOT IMPLEMENTED | Current JSON-RPC tools over POST/request-scoped SSE; token + request -> scoped domain call/result | Validate Origin and audience/resource/tool scope/current membership. Never trust tool text as instructions or token proof. | Protocol/version errors, no session-key auth shortcut, rate/input limits. Older client compatibility separate. Stateless transport, async task extension only if supported. |
| OAuth boundary / NOT IMPLEMENTED | Consent/token issuance/validation/revoke; registered client/PKCE -> scoped audience token | Exact redirects, S256 verifier, issuer/state binding, resource audience, token hashing/encryption appropriate to token type. No downstream token passthrough. | Fail closed on expiry/revocation/mismatch/discovery SSRF. Keys owned by control auth service, not source/runtime. Rotation and provider client policy remain gating work. |
| Sandbox/runtime / BLOCKED | Execute one assigned job only; approved-for-testing source + restricted capabilities -> real execution/events | All generated code/dependencies untrusted. Per-job sandbox, never shared tenants. No control-plane/provider/Git credentials. | Enforced CPU/memory/disk/time/cancel, process kill and artifact validation. Default deny egress with registry-specific proxy. Runtime lifetime tied to job; current code cannot invoke it. |
| Build system / BLOCKED | Resolve pinned deps, build/test exact source; manifest/lockfile -> actual logs/test result/artifact | Isolated runner with read-only declared inputs; dependency scripts are hostile. Build approval distinct from publish approval. | Real nonzero exit/errors; no arbitrary control-plane shell; retries bounded. Input/source/toolchain digests recorded. One job per sandbox; caches segregated and validated. |
| Preview system / NOT IMPLEMENTED | Serve actual checked artifact; private job/artifact -> isolated preview URL | Separate HTTPS hostname/origin, no control cookies, sandboxed iframe without same-origin privilege; parent bridge validates source/origin/schema. | 503/unavailable when runtime/artifact absent, expiry/revoke and crash status. No screenshots as live preview. Artifact never promoted by opening preview. Per-project quotas/TTL. |
| Deployment system / NOT IMPLEMENTED | Explicit reviewed publish + immutable artifact -> health-checked live release | Owner-only plus exact source/artifact approval, destination-specific service credential outside sandbox. | Publish failure remains failed; retry keyed by release, health before live, rollback to known approved artifact. Database rollback separate. Release belongs to project; no account-wide credential delegated to model. |
| Logging / redacted API/audit local | Request IDs, approval audit, future ordered job events; actual event -> tenant-scoped log | Escape rendered output, redact secrets/tokens and private model context. Reads need membership, provider content is untrusted. | Bounded size/retention, truncation explicit, lost-event reconciliation; no fake terminal. Append-only audit and monotonic per-job sequence, never sole work-state source. |
| Monitoring / NOT IMPLEMENTED | Observe availability, errors, quotas/job age; actual metric -> alert/recovery task | Platform-owned thresholds, scoped telemetry, no secret prompts. External alert text does not authorize effects. | Alert delivery failure logged, stale jobs reconciled, no invisible retry loops. Operator policies/incident response needed before production. |

## Threat boundaries and controls
| Untrusted source | Required boundary |
| --- | --- |
| Generated code | Never import/eval in control API. Separate process/isolate per job, input cap, limited runtime capability, validated artifact output. Scanner is not isolation. |
| Dependencies and npm install | Lockfile/pinned package integrity, restricted registry, no ambient secrets, blocked arbitrary postinstall host access, lifecycle scripts run only in job boundary. Supply-chain audit/license review before supported-stack claims. |
| AI output | Schema/file/path checks, bounded changes, no secret retrieval, no model-issued authorization. Source proposals require explicit exact-digest review. |
| MCP/tool output | Treat JSON/text/files as hostile data; no prompt instructions become platform effects. Authenticated transport is not truth/authorization. |
| Repository contents | No trust from README/config/hooks. Strip credential clone URL, do not execute hooks in controller, canonicalize paths and symlink policy. Host token used via restricted proxy only. |
| Uploaded files | Feature currently absent. Before support: enforce bytes/MIME/content sniff, extraction caps/archive traversal/zip-bomb checks, private quarantine and no executable promotion. |
| Preview applications | Own HTTPS hostname, distinct cookie boundary and sandbox iframe. Block access to main API and OAuth cookies; no shared localStorage/service-worker scope. Strict message bridge, limited connect-src/permissions. |
| Environment variables | Control/provider/deploy secrets excluded from runtime entirely. Future app secrets must be scoped and explicitly acknowledged as readable by that app's code; do not pretend encryption prevents code-level access. |
| OAuth tokens | Audience/resource/expiry/scope verified, revoke/rotate, no query-string logging/passthrough, least privilege and current membership. |
| MCP credentials | Separate scoped grants; never export the owner's provider token. Tool scopes and authz checked per request. |
| Deployment credentials | Dedicated controller only, exact project/destination/release allowlist, no model or sandbox access, audit attempts and prohibit paid upgrades. |

## Outbound network contract
Runner is default-deny. Dependency resolution, if eventually allowed, passes a proxy limited to verified package registries and methods, blocks loopback/private/link-local/metadata destinations, rechecks redirects/DNS, bounds bytes/time, and separates read-only package traffic from data-bearing service calls. Network enablement is not an arbitrary Internet toggle. No sensitive value is present in build environment, command line, .git/config, logs or snapshots. External app-service requests go through a server-side capability proxy that authenticates the job and adds only destination-specific credentials after leaving the sandbox. Credential injection must require HTTPS. Every allowed destination is an exfiltration path; minimal authorized data only.

Current source runtime key derives from validated workspace/project/job IDs. A future runner must still resolve these IDs server-side from authenticated records; the helper does not authenticate a user or provision a sandbox. Runtime credentialBindings is an empty/never list.

## Transaction and failure invariants
1. Create workspace and owner membership in a D1 batch.
2. Source proposal bytes/version/digest immutable after creation; server rechecks digest before approval.
3. Owner approval updates current source/revision, audit and immutable source snapshot in the same transaction. Failure in any trigger rolls everything back.
4. Reject has no source/deployment effects. Replay produces no duplicate source version.
5. Future job success requires actual runner/build evidence; artifact validated before persistence. A release references that artifact and approval, not mutable branch HEAD.
6. Timeout/cancel terminal job state cannot later switch to success. Duplicate queue deliveries must reconcile the same idempotency key.
7. Revoke queued work rights before start/return. Failed publish never moves release to live. Preview/publish health do not establish data recovery readiness.

## Incremental implementation, not speculative services
Implemented for Part 2: src/architecture.ts defines role/capability matrix, resource scope, validated runtime-key derivation, terminal job transitions, separate-preview assertion and future Job/Runtime/Artifact/Release ownership contracts. This does not create or simulate jobs/runtime/artifacts/releases.
Migration 0002_source_revisions.sql adds real immutable approved-source history using an approval transaction trigger. Integration regression confirms snapshots persist, cannot be edited and roll back with failed approval. Updated migration harness and local backup tooling apply all schema versions.
Verified: 59 tests passed (seven architecture checks and one new real D1 source-history check), strict typecheck, dry-run build, npm audit 0 reported vulnerabilities, local migration 0002 and backup/restore exact equality/integrity/foreign keys. No resource/account/spending activation or UI change. Remote CI not run; production security, job execution and ownership across actual external services remain acceptance gates, not completed features.

## Review/verification gate before further implementation
The design preserves Part 0/1 scope and is testable without enabling unavailable services. Local contract tests verify role restrictions, runtime-key uniqueness/path rejection, preview origin and terminal-state immutability. Database tests verify actual persistence/rollback. Full design is not marked production-verified until security review and real external identity/runtime/preview/deployment tests pass. Expand only the next user-directed part.

## Current sources and provenance
Primary evidence rechecked for this part:
- https://developers.cloudflare.com/sandbox/concepts/security/ : sandbox smallest trust unit; root capabilities/shared files; secrets outside; separate preview hostname.
- https://developers.cloudflare.com/d1/worker-api/d1-database/ : batch statements transactional, whole sequence rolls back on failure.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization : audience/resource/issuer validation, no passthrough, scoped OAuth boundary.
- https://developers.cloudflare.com/queues/reference/delivery-guarantees/ : at-least-once delivery and idempotent consumer need.
Additional current protocol, browser and service sources are recorded in TECHNOLOGY-DECISIONS.md. Architecture choices are design decisions, not claims of vendor entitlements beyond that evidence. Current account state and operational production readiness remain unverified.
