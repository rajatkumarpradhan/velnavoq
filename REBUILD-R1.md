# Connector rebuild R1: accurate entry and deployment readiness

12 October 2026. This rebuild preserves Parts 1-39. R1 is tested source, not a live deployment.

## Working changes

- Connector-first landing flow: Connect, Describe, Review, Preview, Check/fix, Publish. Removed obsolete 30-minute sign-out and no-database claims.
- Product contract separates supported source features from configured hosting, and names fixed typed backend limits.
- Authenticated GET /api/platform-readiness returns configuration evidence only: MCP address, persistent session policy, release target readiness, AI repair availability and actual backend limits. No secret values, raw environment or guessed live-health result. It remains subject to authentication/read limits and no-store.
- Connect page shows missing hosting/repair as missing, with setup instructions for custom ChatGPT/Claude connectors and the existing Grok route. Client settings are not automatic installation. No claim of external-client verification.
- Removed stale sign-in message about idle logout. Existing Secure/HttpOnly year-long sessions, renewal, expiry timer, rotation and revocation preserved.

## Verification executed

- TypeScript, production UI/Worker build and isolated target dry-run build pass.
- All 37 test files pass in three serial groups: 274 + 148 + 129 = 551 tests. Ten new readiness checks cover unsafe targets/origins, no secret exposure, missing bindings, no fabricated health/client proof and actual session/backend policy.
- Twenty browser UI checks: landing at 360/390/412/1440px, overflow, WCAG axe, sign-in navigation, configuration failure state on Connect. Connect test uses explicit fixture APIs for layout only.
- Ten real local Workers/D1 and persistent-profile browser checks: register, year-long Secure/HttpOnly cookie, authenticated readiness, no-target status, fully close/reopen browser profile, signed-in dashboard and Connect, logout and 401 after revocation, readiness denied anonymously. No injected storage or API mocks in this test.
- Existing year-long UI session timer/request-count regression rerun: me 3, workspaces 1, renewal 1, inbox 1. No immediate expiry loop.
- npm audit: zero vulnerabilities.
- Actual mobile landing/Connect and desktop landing screenshots inspected. No overlap or horizontal overflow; readable status and controls. Local evidence, not the owner's OnePlus or production.

## Deployment and remaining limits

No remote resource created, billable service enabled or public app published in R1. Deployment must create/verify the free control database, separate release Worker/database and preview host, apply migrations, set real origins/bindings and build preview-host URL before rollout. Do not deploy repository placeholder IDs as live configuration. Secret setup stays outside source.

The current generated-app backend is fixed typed D1 public read/create plus controller-owner administration. It is not private app-user authentication/roles, arbitrary backend code, edge functions, billing or production tenancy. Static checks and exact-file HTTP release health do not prove app functionality. External ChatGPT/Claude/Grok installation still needs real-client acceptance. Workers Free CPU and daily ceilings still apply.

## Rebuild sequence

1. R1: accurate connector-first entry, readiness and persistent-session regression (this Part).
2. R2: account-MCP app creation and one reviewed source/schema outcome.
3. R3: explicitly labeled data modes, typed schema and migration safety. Sample fixtures are not real records; no synthetic metrics presented as live.
4. R4: app-user authentication, private roles and tenant isolation.
5. R5: build/preview/check/repair/publish orchestration and rollback.
6. R6: safe fixed function/integration adapters and secrets.
7. R7: mobile flow, motion, performance and accessibility acceptance.
8. R8: real external-client, free-plan deployment, abuse and security acceptance.

This list is a plan, not completed parity. Paid services require separate approval. An Apper-like workflow can use the existing free stack; full feature parity is not yet verified or promised.

## Research sources

See APPER-RESEARCH.md for official docs, conflicting claims and source limits.
