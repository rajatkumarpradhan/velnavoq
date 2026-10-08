# Velnavoq Part 1: technology decisions
by Drayvenn Lab | Reviewed 9 October 2026 | Status: local foundation, not launched

## Decision and non-negotiable boundary
Select TypeScript + Cloudflare Workers Free for the control API, D1 for metadata/authorization/versioned approvals, and immutable content digests for source. Keep deployment disabled. Local code/tests are verified; the current Cloudflare account's live allowance, bindings and entitlements have NOT been inspected or activated. No account, token, subscription, paid plan or policy acceptance was created.

Do not select a supposedly complete runnable stack when its execution requirement is unavailable. The full app-builder runtime decision is BLOCKED under the current no-spend constraint. Static-web-v1 is only the initial source contract, not a substitute for a working full-stack builder. Production identity is also BLOCKED until a suitable verified provider is configured; public-origin password login now fails closed with 503. Local password/session tests remain useful but do not prove Workers Free deployment suitability.

## Evidence-based decision matrix
All quotas below describe official published service allowances, not measured account headroom. Read/write counts, retry counts and retained bytes are not user counts. Exhaustion must be surfaced, never silently upgraded.

| Technology / capability and current limits | Entitlement and decision | Security / failures | Alternatives / migration / complexity |
| --- | --- | --- | --- |
| Workers: JS/TS request API, Streams, bindings; Free 100,000 requests/day, 10 ms CPU/request, 128 MB memory [1,2] | SELECT control plane only. Static assets have separate free request treatment. No arbitrary shell or npm server execution claim. | Origin/CSRF/authz on every object; CPU/memory/quota errors, disconnect and platform restarts. Long HTTP duration does not remove CPU cap. | Pages Functions share Workers billing. Vendor-neutral Fetch handlers reduce migration; D1 bindings remain platform-specific. Low-medium ops. |
| D1: SQLite metadata, indexed reads, transactions through batch; Free 5m rows read/day, 100k rows written/day, 5 GB/account; 10 DBs, 500 MB/DB, 50 queries/invocation [3,4,5] | SELECT metadata, sessions, projects, immutable proposals and audit. Local engine tested; remote DB not created. | Prefixes do not isolate tenants; explicit membership auth. Index scans/write amplification consume quota. Errors/timeouts and migration locking must be visible. Batch rolls back on failed statement. | SQL portability to SQLite/Postgres; triggers and consistency adapters need retesting. Avoid generated DDL. Medium ops. |
| D1 Time Travel: automatic point-in-time recovery, Free 7 days; 10 restores/10 minutes [4,6] | CANDIDATE production recovery; no extra restore cost documented. Not a replacement for encrypted off-site backups. | Account compromise and shared-DB restore can affect all tenants; irreversible recovery requires review and post-restore checks. Not currently a proven remote restore. | Local SQLite backup already tested; remote export/retention pending. Medium-high recovery ops. |
| R2: S3-compatible object artifacts; Standard free 10 GB-month, 1m Class A and 10m Class B/month; free egress [7,8] | DEFER / activation gated. Getting started requires an R2 subscription checkout. Free allowance is not a no-billing guarantee; no checkout accepted. | Private objects, signed access bound to tenant/release; malicious artifacts, URL expiry, accidental public bucket, orphan objects and overage risk. | D1 bounded source bundles now; later S3 adapter or separate artifact store. S3 portability medium; medium ops. |
| SQLite Durable Objects: serialized per-object coordination/alarms, optional hibernating WebSockets; Free 100k requests/day, 13,000 GB-s/day, 5 GB total storage; 1 GB/object [9,10] | VERIFIED free-plan service in docs; DEFER until durable job coordination is needed. Never put two untrusted tenants into one trust object. | Hot-object bottleneck, lifecycle eviction, duration quota, storage-full writes; derive keys from verified workspace/job, not user-supplied IDs alone. | D1 compare-and-swap for current approval; later DO adapter. Proprietary lifecycle high migration risk; medium-high ops. |
| Queues: at-least-once background delivery; Free 10k operations/day, non-configurable 24h retention. 128 KB/message, max 100 message batch, up to 100 retries [11,12] | VERIFIED free; SELECT candidate job transport, NOT ACTIVATED/IMPLEMENTED. 10k operations is not 10k completed jobs: writes/reads/deletes/retries consume operations. | Deduplicate using job key, checkpoints, bounded attempts, DLQ and timeout/cancel. Retention expiry can drop jobs; database remains source of work truth. | D1 outbox plus DO alarms if justified. Queue interface limits vendor lock-in; medium ops. |
| Containers/Sandbox: real Linux dependency installation/build/server environment [13,14,15] | BLOCKED: Containers table Free = N/A, requires Workers Paid ($5 minimum plus usage). SDK is not a free entitlement workaround. | One user/job per sandbox; every process shares files and root-level capabilities. Keep credentials outside; restricted registry egress; separate preview host, quotas and timeouts. | Codespaces owner-limited free quota, browser-local evaluation, or user-approved future paid runtime. OS runner portability medium; high ops. |
| Workers for Platforms: user Workers, dispatch and outbound controls [16] | BLOCKED $25/month. Not needed for current bounded control plane. | Authenticated tenant dispatch, scoped bindings and egress; user script/cache isolation is not arbitrary npm/Linux support. | Ordinary trusted Workers for fixed services; later dispatch adapter. High platform coupling/ops. |
| Dynamic Workers: runtime-loaded isolated JS/Python/Wasm; network blocked with globalOutbound:null, explicit env only [17] | BLOCKED: only Workers Paid. TS/npm must be bundled before loader; not an OS terminal/build environment. | No control secrets, explicit resource proxy, per-job IDs, validate returned output; startup/CPU cost and cross-origin preview. | Paid future lightweight runtime or approved runner; high vendor coupling, medium-high ops. |
| Workers AI: model inference, streaming for supported models; Free 10,000 neurons/day; task/model rate limits; local inference also consumes allowance [18,19] | VERIFIED free pool; SELECT candidate provider binding, not enabled or tested. Some frontier models require Paid/prepaid credit. Do not assume a consumer AI subscription is API permission. | Quota exhaustion/429, unavailable model, untrusted output, private-code disclosure, prompt injection. Bounded patch schema, token budgets, cancellation, no autonomous tool authority. | External client MCP first or user-authorized provider adapter later. Model portability medium; model quality unverified; medium ops. |
| AI function calling: supported models return tool names/arguments; JSON mode requests structured data [20,21] | AVAILABLE features, model-specific, not universal. JSON mode currently does NOT stream; may fail with 'JSON Mode couldn't be met'. Covered by model inference quota/entitlement, not unlimited free tools. | Server validates each name/argument/scope; model output is not authorization. Never give model arbitrary functions, credentials or unreviewed effects. | Plain structured patch output plus validation; small capability-specific adapters. Low-medium code complexity, high safety burden. |
| Workers AI asynchronous Batch: queued request_id, poll later, total payload <10 MB; supported model catalog [22] | DOC-DESCRIBED, not verified on Rajat's account/model. No feature-specific Free restriction appears on fetched batch page, but model eligibility/neuron usage still apply. DEFER. | Not interactive streaming; cancellation/timeout, partial results, inference accounting and result validation need proof. | Bounded sequential jobs or queue workers. Medium adapter and ops complexity. |
| AI Gateway: analytics/cache/rate-limit core free on all plans; retries/fallbacks documented [23,24,25,26,27] | OPTIONAL, not activated. No fee is documented on fetched retry/fallback pages; provider inference still costs/consumes quota. Do not infer free paid-provider fallback. | Cache exact identical text/image requests, not semantic cache; skip private tenant source initially. Max five retry attempts; per-request delay max 5s versus gateway-default setting 0.1-60s. Final request-handling retry may wait indefinitely; impose outer job deadline. | Direct binding with own bounded retry first. Adapter preserves provider flexibility. Gateway configuration migration medium; ops medium. |
| Gateway log/billing controls [23,26] | New first gateways on/after 24 Sep 2026 use Workers Logs pricing/retention; older gateways have legacy quota. New vs old status unknown. Unified Billing/prepaid credits NOT authorized. | Prompts/logs may expose code/secrets. Skip/redact sensitive logs. Fallback credentials/payment behavior must be explicitly restricted; Guardrails uses AI inference quota, not free unlimited scanning. | Minimal redacted own job events. Storage/retention decisions pending. |
| MCP 2026-07-28 specification: JSON-RPC 2.0, stateless self-contained requests, per-request capabilities; POST JSON or request-scoped SSE [28,29] | SELECT protocol target only; MCP NOT IMPLEMENTED. Current version removed GET stream and protocol sessions. Compatibility with older client versions must be separately tested, not assumed. | Validate Origin, local localhost binding, per-call auth/scope/resource ownership, payload limits, no fake connection. Treat tool results as untrusted. | Plain authenticated API first; MCP transport adapter. Version negotiation high migration/testing burden. |
| MCP auth, OAuth 2.x/PKCE [30,31,32,33] | SELECT OAuth authorization code + S256 PKCE requirement; implementation/provider blocked. OAuth 2.1 referenced draft is not a finalized RFC claim. No OAuth client created. | Exact redirect, state/issuer binding, audience/resource indicators, expiry/revoke, protected-resource metadata, no token passthrough. Refuse SSRF through discovery URL; least-privilege tools, explicit human approve/publish scope. | OIDC provider identity vs self-hosted OAuth server: provider reduces auth surface, but credentials/policy/account choice unresolved. High security ops. |
| OWASP ASVS 5.x [34] | SELECT 5.0 baseline checklist. Local regression tests are not ASVS certification. | Verify authentication/session/access-control, injection, secrets/logs, transport and architecture. Dependency audit is not independent security review. | Threat model + targeted abuse tests plus later external review. Low migration, high verification work. |
| WCAG 2.2 [35] | SELECT AA target, no current UI compliance claim. | Keyboard/focus, contrast, target size, accessible errors/authentication, reduced motion. Actual mobile/assistive-tech checks required. | Native semantic components; test desktop/OnePlus/Safari independently. Low lock-in, medium QA. |
| Browser/CSP/security [36,37,38] | SELECT strict API CSP/no-store/nosniff/referrer/Permissions-Policy; separate preview origin. API header policy implemented and tested. | Generated scripts hostile; never same-origin app preview, iframe sandbox without allow-same-origin, validate postMessage origin/source/schema, block parent API access. CSP supplements isolation, not scanner-as-sandbox. | Opaque sandbox plus separate host/controlled bridge, not eval in control app. Browser compatibility/COOP/COEP need testing; medium-high complexity. |
| SSE/WebSocket/streaming [2,29,39,40] | SELECT per-job authenticated SSE for one-way logs/status; WebSocket/DO only when collaboration needs it. Neither live job stream nor fake terminal implemented. | Disconnect/reconnect, bounded buffers, heartbeat, resumable event IDs, backpressure and cancellation. SSE HTTP/1.x browser connection limits; HTTP/2 differs. Browser EventSource cannot freely set Bearer headers: use authorized fetch streaming or appropriate cookie boundary. | Poll known job IDs fallback, then WS bidirectional adapter. Streaming response alone does not persist a background job. Medium complexity. |
| Git/versioning [41,42] | SELECT immutable source SHA-256 digests + base revision/approval; optional native Git adapter later. Existing repo code uses actual Git commits. App Git UI/rollback NOT IMPLEMENTED. | Git commit does not authorize execution; malicious hooks/checkout paths/scripts, secret history and stale/force pushes. Release hash must bind canonical files/schema/permissions, not merely a branch name. | Snapshot/diff model initially, provider Git API later. Content model portable; native Git/runtime high ops. |

## AI Gateway / Workers AI findings requested explicitly
Yes, current Gateway docs describe caching, rate limiting, retries and model/provider fallbacks. Core caching/rate limiting/analytics is expressly free. Retry/fallback pages do not list a separate Paid entitlement, but no authenticated gateway/configuration was tested. Costs/neurons from each model attempt still apply. Do not connect a paid fallback or Unified Billing. Cache is exact-match text/image only; private code caching is off by policy.
Workers AI function calling and JSON mode are real model-dependent capabilities. JSON schema is not guaranteed; schema errors and validation failures are expected. JSON mode does not stream. Batch is queued asynchronous inference, not runnable app builds; payload <10 MB and catalog compatibility must be confirmed. Free 10k neurons/day applies, with explicit paid-only model exceptions.

## Final stack and phase gates
Verified local foundation: TypeScript/Workers Fetch API + D1 SQLite + exact-source immutable proposals + transactional approval + server authz/session/CSRF + bounded input/rate limits + local restore tooling. Independent of untrusted runtime. Added researched infrastructure policy with all cloud features disabled and public password flow gated.
Candidate beta infrastructure: Workers static frontend, D1 metadata, SQLite DO only for coordination, Queues for jobs, Workers AI eligible model and optional Gateway, per-job SSE, current MCP/OAuth adapter. These are NOT yet enabled and are not full-stack completion.
Blocked/unresolved: isolated hosted app runtime, authenticated deployment/preview service, R2 subscription, production identity/invites/provider policies, actual account quotas, model selection/quality, encrypted remote disaster recovery, mobile/security audit. No free hosted complete builder promised.

## Part 1 implementation and real results
- src/infrastructure.ts: dated service references and disabled activation flags, production auth gate, current MCP target, S256/no-token-passthrough/separate-preview/no-paid-fallback policies.
- src/auth.ts: localhost-only password flow; public origin returns 503 before password work.
- src/index.ts: restrictive browser Permissions-Policy on API responses.
- Tests: four infrastructure policy tests plus two real Workers/D1 API regressions. Total 51/51 passed, strict compile, dry-run bundle and npm audit (0 reported vulnerabilities). Local backup/restore exact equality, integrity and foreign keys remain passing.
- No inference, gateway, queue, DO, R2, sandbox, OIDC provider, remote deployment or remote CI was activated. No visual UI change made, so no UI readiness claim.

## Sources: fetched primary documentation
[1] https://developers.cloudflare.com/workers/platform/pricing/
[2] https://developers.cloudflare.com/workers/platform/limits/
[3] https://developers.cloudflare.com/d1/platform/pricing/
[4] https://developers.cloudflare.com/d1/platform/limits/
[5] https://developers.cloudflare.com/d1/worker-api/d1-database/
[6] https://developers.cloudflare.com/d1/reference/time-travel/
[7] https://developers.cloudflare.com/r2/pricing/
[8] https://developers.cloudflare.com/r2/get-started/
[9] https://developers.cloudflare.com/durable-objects/platform/pricing/
[10] https://developers.cloudflare.com/durable-objects/platform/limits/
[11] https://developers.cloudflare.com/queues/platform/pricing/index.md
[12] https://developers.cloudflare.com/queues/platform/limits/
[13] https://developers.cloudflare.com/containers/platform/pricing/
[14] https://developers.cloudflare.com/sandbox/sdk/platform/pricing/
[15] https://developers.cloudflare.com/sandbox/concepts/security/
[16] https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/
[17] https://developers.cloudflare.com/dynamic-workers/llms-full.txt
[18] https://developers.cloudflare.com/workers-ai/platform/pricing/
[19] https://developers.cloudflare.com/workers-ai/platform/limits/
[20] https://developers.cloudflare.com/workers-ai/features/function-calling/
[21] https://developers.cloudflare.com/workers-ai/features/json-mode/index.md
[22] https://developers.cloudflare.com/workers-ai/features/batch-api/
[23] https://developers.cloudflare.com/ai-gateway/reference/pricing/
[24] https://developers.cloudflare.com/ai-gateway/features/caching/
[25] https://developers.cloudflare.com/ai-gateway/configuration/request-handling/index.md
[26] https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/
[27] https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/
[28] https://modelcontextprotocol.io/specification/2026-07-28
[29] https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
[30] https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
[31] https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
[32] https://www.rfc-editor.org/rfc/rfc9700.html
[33] https://datatracker.ietf.org/doc/html/rfc7636
[34] https://owasp.org/www-project-application-security-verification-standard/
[35] https://www.w3.org/TR/WCAG22/
[36] https://www.w3.org/TR/CSP3/
[37] https://html.spec.whatwg.org/multipage/iframe-embed-object.html
[38] https://developers.cloudflare.com/sandbox/network/
[39] https://developers.cloudflare.com/workers/runtime-apis/websockets/
[40] https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
[41] https://git-scm.com/docs/git-hash-object
[42] https://git-scm.com/docs/hash-function-transition (search excerpt only; not used for a version-specific implementation decision)

Confidence: high for fetched published behavior/quotas; medium for architecture fit; unknown for current account entitlement/headroom, concrete runtime/provider quality, client compatibility and production readiness. No unofficial tutorials were used to grant entitlement.
