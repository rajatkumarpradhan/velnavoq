# Velnavoq Part 24 - Abuse, Quotas and Cost Control

Status: implemented and tested locally (Worker + D1 on miniflare). Not deployed. Free-only: nothing here needs a paid plan, card, R2, domain or model key.

## What this adds

One registry, `src/quota.ts` (`LIMITS`), holds every number. The API, the usage panel, the user messages and this table all read from it, so they cannot disagree.

- Migration `0019_quotas.sql`: `usage_counters`, `quota_denials`, `abuse_cooldowns`. Content-free: ids, metric names and numbers only.
- `src/quota.ts`: atomic consume, refund, gauges counted from the real tables, cooldown, route rules, usage report, AI cost guard, sign-in lockout.
- Hooks (small): `src/index.ts` (one call per authenticated request plus a 429/403 response shape), `src/auth.ts` (sign-in lockout), `src/ai-storage.ts` (AI caps around the existing D1 budget), `src/mcp-api.ts` (per-project MCP call cap).
- API: `GET /api/quota` (your account) and `GET /api/projects/:id/quota` (project, its workspace, your account, service-wide AI).
- UI: the existing "Usage & limits" page now shows live counters with accessible meters.

## How a limit works

1. Windowed limits (per minute, hour or UTC day) use one SQL statement: `INSERT ... ON CONFLICT DO UPDATE ... WHERE count + n <= limit RETURNING count`. If the row is not returned, the limit was hit. Two requests at the same moment cannot both pass the last slot (tested: 25 parallel requests against a limit of 10 give exactly 10). No trigger and no CASE, so it also works on D1.
2. Total limits ("gauges": projects, workspaces, bytes stored, running jobs, environment entries) are counted from the real tables each time, so they cannot drift from reality.
3. The check runs before the work starts. A denied build creates no job.
4. Any D1 error while checking fails closed (the request is refused, not allowed).

## Limits

| Metric | Scope | Window | Limit | What it counts | Threat covered |
|---|---|---|---|---|---|
| `requests.minute` | user | minute | 300 | requests | network abuse |
| `workspaces.total` | user | total | 5 | workspaces you own | user quota |
| `storage.bytes.user` | user | total | 100 MB | bytes of stored source and build output across your workspaces | storage abuse |
| `ai.tokens.day.user` | user | day | 60000 | AI tokens | denial-of-wallet |
| `jobs.active.user` | user | total | 4 | jobs running at once across all your projects | CPU abuse |
| `projects.total` | workspace | total | 10 | projects in this workspace | workspace quota |
| `storage.bytes.workspace` | workspace | total | 50 MB | bytes of stored source and build output in this workspace | storage abuse |
| `ai.tokens.day.workspace` | workspace | day | 60000 | AI tokens | denial-of-wallet |
| `storage.bytes.project` | project | total | 10 MB | bytes of stored source history and build output in this project | storage abuse |
| `jobs.active.project` | project | total | 2 | jobs running at once in this project | infinite builds, CPU and memory abuse |
| `proposals.day` | project | day | 100 | change proposals | storage abuse |
| `builds.hour` | project | hour | 10 | builds | infinite builds |
| `builds.day` | project | day | 30 | builds | infinite builds |
| `terminal.hour` | project | hour | 120 | terminal runs | CPU abuse, package-install abuse |
| `previews.hour` | project | hour | 30 | preview starts | CPU and network abuse |
| `repair.day` | project | day | 10 | AI repair runs | infinite AI loops |
| `agent.hour` | project | hour | 20 | AI coding agent runs | infinite AI loops |
| `ai.requests.minute` | project | minute | 10 | AI requests | infinite AI loops |
| `ai.tokens.day.project` | project | day | 40000 | AI tokens | denial-of-wallet |
| `deploys.hour` | project | hour | 4 | deployments | deployment spam |
| `deploys.day` | project | day | 10 | deployments | deployment spam |
| `editor.saves.hour` | project | hour | 600 | editor saves | storage abuse |
| `versions.day` | project | day | 100 | version snapshots | storage abuse |
| `environment.writes.hour` | project | hour | 60 | environment or secret changes | credential abuse |
| `environment.entries` | project | total | 50 | environment entries | storage and credential abuse |
| `mcp.calls.minute` | project | minute | 60 | MCP tool calls | MCP tool abuse |
| `mcp.admin.day` | project | day | 30 | MCP client, token or consent changes | MCP and credential abuse |
| `ai.tokens.day.global` | global | day | 120000 | AI tokens across the whole service | denial-of-wallet: sized to stay under the free Workers AI allowance of 10,000 neurons/day, based on one reported sample (see ABUSE-CONTROL.md) |
| `login.failed.hour` | account | hour | 10 | failed sign-ins for this account | credential abuse |

Existing hard limits from earlier Parts stay in force and are not duplicated: terminal and build timeout max 5 s, 16 MB QuickJS memory, 256 KB stack, 32 KB output, 500,000 bytes per file, 600,000 bytes per build artifact, 50 files, no network, no package registries (dependencies are rejected), AI repair loop of 2 attempts / 60 s / 4 files, per-project AI token budget with the `ai_reserve` trigger, one running build and one running terminal job per user (unique indexes), IP rate limits.

## Threat to control map

| Threat | Control |
|---|---|
| Infinite AI loops | `repair.day`, `agent.hour`, `ai.requests.minute`, existing 2-attempt repair bound, per-request attempt cap, token reservation per attempt |
| Infinite builds | `builds.hour`, `builds.day`, `jobs.active.*`, job deadline (5 s), unique running job per user |
| Package-install abuse | Registries list is empty and dependencies are rejected (Part 11); `terminal.hour` also caps attempts |
| CPU abuse | 5 s hard deadline, `jobs.active.project` 2, `jobs.active.user` 4, request ceiling |
| Memory abuse | QuickJS 16 MB heap, 256 KB stack, output 32 KB (existing), concurrency caps above |
| Storage abuse | project 10 MB, workspace 50 MB, user 100 MB (source history plus build and ship artifacts); proposals, saves and snapshots per day |
| Network abuse | `requests.minute` per user, existing per-IP limits, runtime network deny-all |
| Deployment spam | `deploys.hour` 4, `deploys.day` 10, shared with rollback; running ship job cap |
| MCP tool abuse | `mcp.calls.minute` per project, `mcp.admin.day` for clients, tokens and consents, existing OAuth+PKCE and digest-bound approvals |
| Credential abuse | `login.failed.hour` (10 per hashed account key, also for unknown emails so accounts cannot be enumerated, reset on success), `environment.writes.hour`, `environment.entries`, secrets never appear in quota responses |
| Denial-of-wallet | four AI daily caps (service, owner, workspace, project) on top of the per-project budget; `QUOTA_FREEZE_AI=true` pauses all AI at once; repeated limit hits trigger a 15 minute cooldown on costly actions |

## Messages the user sees

HTTP 429 (resets with time) or 403 (a total, nothing resets) with JSON `{error, metric, scope, limit, used, window, resetsAt, retryAfterSeconds, message, requestId}` and a `Retry-After` header. Examples (exact text from the code):

- "You have used 10 of 10 builds per hour. Try again in about 50 minutes. Nothing was lost."
- "You have reached the limit of 10 projects in this workspace. Remove one you no longer need, then try again."
- "Too many failed sign-in attempts. Sign-in for this account is paused for about 60 minutes. Nothing was changed."
- "AI is paused for everyone today to stay inside the free usage allowance. It resumes in about N hours. Your work is saved."
- "You hit limits many times in a row, so costly actions are paused for about 15 minutes. Reading and saving your work still works."

Messages never contain ids, other users, SQL or stack traces (tested).

## Cooldown

25 denials by one user within 10 minutes pause costly actions for 15 minutes. Reads, saves, sign-in and the usage page keep working. Denials caused by AI caps are attributed to nobody, so a collaborator cannot put the workspace owner into cooldown.

## AI cost guard

Every AI attempt reserves tokens (input plus max output). The reservation passes the service, owner, workspace and project daily counters; if one layer refuses, the layers already charged are refunded. On settle, unused tokens are returned to every counter. Missing usage never refunds (conservative, same rule as Part 8).

Basis for the service-wide cap: the Part 23 live addendum in `QA.md` reports one Qwen call of 36 tokens costing 2.22 neurons, about 0.062 neurons per token. At that rate 120,000 tokens is about 7,400 neurons, under the free 10,000 neurons per day. This is one reported sample, not a guarantee; larger prompts or other models can cost more per token. Cloudflare's own dashboard is the authority on real usage.

## Limits of this Part (read once)

- Local only. Not deployed; D1 migration `0019` has not been applied to the live database.
- Reserved tokens are an upper estimate, not measured neurons. There is no billing meter.
- The editor-save and storage checks stop new writes once a cap is reached; one request can overshoot by its own size (proposals check their body size up front).
- Per-user AI cap is attributed to the workspace owner because the existing AI budget layer only knows the project.
- Quota counters are per D1 database; they do not stop an attacker who never reaches the Worker. Network-level DDoS protection is Cloudflare's, not this code.
- Public sign-in is still gated (503 outside localhost) from Part 21, so the sign-in lockout is verified locally only.
- No admin UI to raise or lower limits per user; limits change by editing `LIMITS` and redeploying. No paid tiers exist.
- The cooldown counts denials, so a legitimate heavy user can trip it; the message says how long.
- Concurrency counts only jobs inside their own deadline, so a crashed job cannot lock a project but also is not reaped by this Part.

## Tests

`tests/quota.test.ts` (23 tests, real Worker + D1): registry bounds, atomic parallel consume, window reset and refund floor, oversize request, build/deploy/terminal/AI-loop/MCP/environment caps through the real API, gauges (projects, workspaces, storage), concurrent jobs and expired jobs, request ceiling, cooldown scope, credential lockout without enumeration, AI four-layer cap with rollback and settle refund, usage report scope, message text, route coverage. `scripts/quota-evidence.mjs` drives the UI at 360 and 390 px (overflow, 24 px targets, axe, meter names, warning).
