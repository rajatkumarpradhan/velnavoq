# Part 30: project-scoped MCP source and static release Autopilot

## Implemented

- Modern 2026-07-28 requests plus stateless initialize-based 2025-03-26, 2025-06-18 and 2025-11-25 Streamable HTTP JSON. No SSE streams, server sessions or remote-tool proxy.
- Separate OAuth scopes: project.read, files.read, patch.propose, sandbox.write, checks.run, preview.create, repair.run, release.publish. Existing tokens are not upgraded.
- list_files returns paths and exact digests; files returns one bounded source file. apply_patch supports CREATE/MODIFY/DELETE/RENAME, digest-bound source, up to 50 changes, 50 files/500KB total. Delete/rename require an additional owner checkbox. Review-only propose_patch remains limited to four changes and never applies.
- Owner-only project Autopilot is off by default. Owner chooses a registered client, source-only or source + public-release permission, and optional delete/rename. UI grants one hour; API accepts 1-24 hours. It can be stopped immediately. OAuth scopes alone never enable Autopilot.
- Source apply rechecks owner, client/token/grant expiry and revocation, current revision, delete permission and maximum changes. A database trigger repeats critical approval checks in the apply transaction. A project has one active source run. Old runs time out after 55 seconds. Files/secrets/account settings/billing outside the project are unavailable.
- run_checks performs real server-side static validation: supported bundle, HTML/JS/JSON syntax, local asset/module references, dependency restrictions and known-secret scan. It never executes generated code or user test suites. CSS is checked for local asset references, not full CSS syntax or design correctness.
- preview prepares a persisted server-checked build artifact and a 10-minute private preview session. It does not claim rendering occurred. The owner opens the separate browser preview host through the existing Live preview screen. Browser telemetry is unverified.
- repair uses current server static diagnostics and the existing free Workers AI provider. At most two model attempts, each 20 seconds, with source-only apply and repeated checks. A failed loop returns needsExternalFix. External AI can also read the diagnostic and submit another exact patch. Existing AI budgets and service caps remain in force. Free provider repair changes at most four files per model response.
- publish checks saved static source and uses the existing target installation and real served-file health path. Permission is pinned to the configured target origin. Grants/revocation/current source are checked before install, through health, and before promotion. A database trigger gates the final release on current authority. No controller/account deployment tool exists.
- Failed release health leaves the previous healthy release selected. This is safe promotion, not deletion or withdrawal of installed immutable URLs. Instant off stops future apply/promotion; it cannot retract source already shared, a URL already published or already observed data. Health checks verify exact served bytes, artifact digest and sandbox CSP, not functional app correctness.
- Clinic request regression: planner states exact static path rules, including index.html, css/styles.css and js/app.js. A backend-sized request produces a static interface only, explicitly labeled as local-only in its page. Every agent_* UI error has readable text, including an unknown-code fallback.

## Limits and not done

This Part does not build a running backend, database app, npm framework, Linux runtime, patient system or actual appointment service. It supports HTML/CSS/JS/JSON/SVG/text and local assets only. It does not guarantee every large request fits the free model's 2048-output-token response. Source generation remains reviewed by default; MCP Autopilot is an explicit opt-in.

Clients still require pre-registration and owner OAuth PKCE consent. Dynamic registration, client metadata URL fetching and universal one-click external installation are not implemented. Supporting initialize does not prove ChatGPT, Claude or Grok installation. These clients' current policies, plans and callback flows require live tests after deploy. The local reference OAuth client is not external-client verification.

MCP request maximum remains 200KB; each read file maximum 100KB, tool result 150KB. A 500KB project can be read one file at a time, written in bounded batches, or checked server-side. Returned applied-patch receipts omit full changed content to stay small.

Existing rate and storage quotas apply: 100 proposals/project/day; 10 check builds/hour and 30/day; 30 preview starts/hour and two active sessions/user; 10 repair calls/day; 4 deployments/hour and 10/day; 10MB project source/artifact history. AI caps remain 120k tokens/day service, 60k/user, 60k/workspace, 40k/project, plus owner budget. No paid fallback.

## Verification

Typecheck, UI/full Worker build and target dry-run build passed. 501 tests passed across bounded serial groups covering all 28 test files. New checks include 50-file application, exact clinic prompt rules, human-readable errors, legacy requests, source-only grant refusal/revocation, stale source, delete opt-in, two-attempt repair, revoke during model request, prepared preview, public-release permission requirement, guarded Autopilot publication, failed health retaining known-good and revoke before promotion. Autopilot release tests use a controlled server-side target and mocked HTTP health responses; existing deployment tests cover real local HTTP served bytes. No live production change by this builder.

390px mobile UI inspected: MCP consent and Autopilot controls, compact checkboxes, no page horizontal overflow; clinic request readable error. Visual test responses are isolated local fixtures, not live AI proof. Real production/external-client tests remain after deploy.

## Deployment handoff

Apply migration 0022_mcp_sandbox.sql before deploying the new Worker. Build UI and Worker. Preserve production D1, AI, DEPLOY_TARGET, DEPLOY_ORIGIN, DEPLOY_MODE, secrets and APP_ORIGIN. Keep REGISTRATION_ENABLED=true and the current src/ai-adapters.ts. Do not deploy the repository's local placeholder vars as production config. No new resource or paid plan is required.

## Part 31 sketch (not implemented here)

Use a separately designed, fixed backend/data API on free Workers+D1, not arbitrary generated server code in the controller. Declarative project schemas, typed CRUD operations, project-qualified table/row ownership, prepared SQL, explicit row/field permissions, input/output limits, migration versioning and snapshot backups. MCP schema/data operations use separate owner scopes and the same opt-in project Autopilot model. Start with synthetic/non-sensitive data. No public patient/payment/identity data until auth, access isolation, deletion/export, abuse controls and security tests are passed. Free request/CPU/database ceilings mean no promise of unlimited large apps; real frameworks and arbitrary server runtimes stay out of scope.

Protocol references inspected:
- https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
