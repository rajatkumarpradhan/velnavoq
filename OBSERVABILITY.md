# Part 19 - Observability

Implemented code and tests, not live production verification. No paid service, account, card, domain or model key was added. The existing Cloudflare verification block is not cleared.

## Event contract

Every control-plane request receives a new server-generated UUID in `x-request-id`. Incoming request ID headers are ignored. Authorized project requests are correlated with project IDs. Build, terminal, preview, repair and deployment jobs store their creator request ID atomically. AI events use the AI engine's request ID and per-attempt duration.

Structured logs contain only allowlisted metadata: request/project/job IDs, kind, fixed event code, severity, HTTP status, duration, reported token counts and timestamp. No URL, query, header, cookie, body, email, prompt, source, environment value, raw exception or model response is logged. Invalid identifiers and unknown event names are discarded or replaced by fixed codes. Preview messages are stored as fixed status codes, not arbitrary browser text. Existing terminal/build diagnostic endpoints still apply their previous secret rejection and access policy; observability never copies their raw output.

Request failures, authentication failures, authorization failures, runtime failures and MCP transport/tool errors are recorded. MCP tool errors are logged even when JSON-RPC returns HTTP 200. Unauthorized requests do not acquire a project identity just because a URL names one. Unattributed auth/MCP failures stay in operator-only logs, not another user's project timeline.

Job timelines come from database INSERTs, real status changes and receipt ingestion. Each transition records a timestamp and provenance. Browser build, terminal and preview events remain `browser-unverified`; server lifecycle events are `server-state`; AI attempts are `provider-event`. Browser success is never upgraded to verified production success. No percentages, inferred future steps or invented historical progress. Existing jobs have no backfilled timeline unless a new actual event occurs.

## Measurements and limits

- Request duration: server elapsed time, before the telemetry write.
- Static browser build duration: browser-reported, explicitly untrusted. Server elapsed job time is shown separately.
- Deployment static validation build duration: actual building-to-deploying event interval, available as `shipping.trusted_build_average_ms`.
- AI attempt duration: measured around actual engine iteration, including errors. Only reported usage counts as observed tokens. Missing usage is NULL/unknown, not zero. Reservations are budget accounting, not usage or pricing.
- Deployment status: actual persisted stages including blocked, failed and timed-out. Preview/runtime failures retain their provenance.

Project logs are bounded to 7 days and 1,000 rows per project. Timelines are bounded to 7 days and 2,000 rows per project. Insertion prunes old/excess rows; read-time expiry excludes quiet stale projects. Source job and AI metrics use retained source records, not the short log window. There is no persistent external log sink or alert service.

A failed best-effort request telemetry write emits a fixed `telemetry_unavailable` operator event and `x-observability-status: unavailable`; it does not turn a completed action into a retryable error. Job timeline trigger writes are transactional with the job mutation. D1 quota exhaustion can therefore block a job mutation rather than silently lose its timeline. Provider console retention/access is controlled by the Cloudflare account; project log APIs never expose it.

## APIs and UI

All reads require a current authenticated project membership. No client event-write API exists. Viewer members may inspect project metadata; nonmembers receive 404. Logs are read-only, parameterized and bounded.

- `GET /api/projects/:id/observability/logs`: exact `kind`, `level`, `event`, `requestId`, `jobId` filters. `before` gives descending cursor pagination, 100 rows/page.
- `GET /api/projects/:id/observability/jobs`: recent actual job IDs.
- `GET /api/projects/:id/observability/jobs/:jobId`: actual timeline; `after` gives ascending cursor pagination, 100 rows/page.
- `GET /api/projects/:id/observability/metrics`: observed durations, reported/unknown usage, build and deployment counts. No price estimate.

The Observability screen is available through navigation/command palette. It offers project metadata search, measured usage and job inspection. Refresh is manual, no background polling. Lists show a compact first five logs with expansion; timeline IDs wrap on mobile. Loading, empty and error states are explicit.

## Verification

`npm run check`: typecheck, both Worker dry-run builds, 348 tests across 17 files, npm audit (zero vulnerabilities). Part19 adds 13 tests using real local workerd/D1 plus existing deployment/rollback tests. Tests cover correlation spoofing, no sensitive payload copying, membership denial, forged event POST denial, parameterized searches, actual timeline writes, immutability, authentication/runtime/MCP failures, measured AI usage/unknown usage, bounded retention/cursors and visible telemetry failure.

`npm run ui:build` and `node scripts/observability-check.mjs`: 21 checks against the actual local Worker/D1 API, real queued/blocked deployment timeline, request ID search, no fake success/percentages, no overflow and WCAG checks at 360/390/412/1440px. Actual 360px and 390px screenshots inspected. `python3 scripts/check-backup.py`: populated-schema upgrade, binary/SQL restore and deletion graph.

## Honest boundary

This is production-oriented observability implemented and verified locally, not telemetry from a live production deployment. No public target or production traffic exists yet. Workers Free CPU/write quotas and sustained-load behavior are unproven. There is no uptime monitoring, trace propagation into generated apps, background watchdog or durable external alerting. HTTP health checks still prove delivery, not application correctness. Missing AI usage remains unknown; no paid model call was made to manufacture metrics.
