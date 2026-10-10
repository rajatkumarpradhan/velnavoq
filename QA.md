# Velnavoq - Full QA Report (Part 23)

Generated: 2026-10-10T05:01:47.179Z | Node v22.23.3 | linux/x64

Stack: free-only: miniflare workerd + D1 + Playwright chromium (headless), no paid services

Rule followed: every PASS below comes from an actual execution in this run. Anything not executable on a free-only stack is listed as NOT RUN with the reason and the substitute evidence.

## Totals

- Script check suites: **18 / 18 PASS** (306 individual checks)
- Unit/integration (vitest): **385 tests across 20 files - PASS**
- E2E scenarios TEST 1-10: **32 steps PASS, 3 NOT RUN, 0 FAIL**
- Static gates: typecheck PASS, worker build PASS, target build PASS, npm audit PASS (vulnerabilities: {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}), backup check PASS

## Requested category coverage

| Category | Where executed | Result |
|---|---|---|
| Unit | vitest: 385 tests / 20 files | PASS |
| Integration | vitest integration suites + API check scripts | PASS |
| API | integration.test.ts, hardening.test.ts, observability-check (21 checks) | PASS |
| Authorization | security-auth-check (18 checks), TEST 9 cross-tenant | PASS |
| Database | persistence/D1 migration-backed tests in vitest, versioning-check (20 checks) | PASS |
| AI adapter | TEST 2/TEST 3 fail-closed 503 evidence; repair-check (16 checks) | PASS |
| Sandbox | TEST 10 isolation probe; preview-check (29 checks) | PASS |
| Build | build-check (23 checks), TEST 2/3/4/6 real browser builds | PASS |
| Preview | preview-check, TEST 2 two-host preview, TEST 10 sandbox | PASS |
| MCP | mcp-check (20 checks), TEST 5 full PKCE flow | PASS |
| OAuth | TEST 5 authorize->consent->token->revoke, mcp-check | PASS |
| Deployment | deployment-check (18 checks), TEST 7 local HTTP release + health check | PASS |
| Rollback | TEST 8 bad release -> rollback byte-exact, versioning-check | PASS |
| Accessibility | accessibility-check (? checks), accessibility-evidence, axe at 4 widths in mcp/preview checks | PASS |
| Responsive | 360/390/412/1440 viewport layout+axe assertions in mcp-check and preview-check; qa-report.html verified at 360px and 390px | PASS |
| Security | security-check (8 checks), security-auth-check, npm audit 0 vulns, TEST 9/10 | PASS |
| Failure recovery | TEST 3 build error -> fail-closed repair -> manual repair -> rebuild; TEST 8 rollback; navigation-check 500/offline routes (39 checks) | PASS |

## E2E scenarios TEST 1-10 (actual recorded results)

| Scenario | Step | Result | Evidence |
|---|---|---|---|
| TEST 1 | register new user via API | PASS | session issued |
| TEST 1 | create workspace | PASS | 829266e3-4630-4f69-b7b1-6c53705a6d1b |
| TEST 1 | create project | PASS | fe51a3eb-85ce-4787-aee4-da2a62b4f67c |
| TEST 1 | sign in through the real UI form | PASS | form sign-in reaches app shell |
| TEST 1 | project reachable in UI | PASS | project build panel renders |
| TEST 2 | prompt sent to AI request endpoint | PASS | fail-closed 503 ai_provider_not_connected |
| TEST 2 | AI model generates files from prompt | NOT RUN | no AI provider connected (free-only, no key); endpoint verified fail-closed above |
| TEST 2 | files produced through the validated agent patch path | PASS | hello.html approved at revision 2 |
| TEST 2 | real browser build succeeds | PASS | Build static app -> succeeded |
| TEST 2 | two-host preview renders built app | PASS | separate origin preview ready |
| TEST 3 | inject intentional build error | PASS | broken app.js approved |
| TEST 3 | build fails with real diagnostic | PASS | failed, exit 1, syntax diagnostic |
| TEST 3 | repair session bound to the failure | PASS | propose fail-closed 503 repair_ai_provider_not_connected |
| TEST 3 | AI repair generates the fix | NOT RUN | no repair AI provider connected (free-only); propose verified fail-closed above |
| TEST 3 | corrective patch applied and rebuild succeeds | PASS | rebuild succeeded after repair |
| TEST 4 | editor save creates auto-approved revision | PASS | revision 5 |
| TEST 4 | build after editor save succeeds | PASS | build succeeded |
| TEST 4 | built artifact contains the edited file | PASS | hello.html in ZIP has manual edit |
| TEST 5 | register MCP client and authorize with PKCE consent | PASS | client authorized, token issued |
| TEST 5 | authorized MCP tool call returns real project | PASS | velnavoq.project returned exact project |
| TEST 5 | revoke token denies further calls | PASS | revoked token -> 401 |
| TEST 6 | create masked secret and build | PASS | masked SERVICE_TOKEN created, build succeeded |
| TEST 6 | secret never reaches API, build log or artifact | PASS | canary absent from API, log, ZIP, context |
| TEST 7 | pin immutable source release | PASS | release v1 pinned |
| TEST 7 | deploy to local target with real health check | PASS | release local-http |
| TEST 7 | health check: served release matches published bytes | PASS | http://127.0.0.1:5192/r/cf7dbc26-e901-4feb-9e3f-ad44563dbf5e/index.html |
| TEST 7 | public app on the internet | NOT RUN | no public deployment exists (free-only, workers_dev off, no domain); local HTTP release URL verified above |
| TEST 8 | deploy a second (bad) release | PASS | bad release live at target |
| TEST 8 | rollback restores exact known-good bytes | PASS | routing repointed to known-good bytes |
| TEST 9 | second user registered in separate tenant | PASS | user B ready |
| TEST 9 | user B denied every access to user A project | PASS | read project:404 inject patch:404 read versions:404 read environment:404 start build:404 |
| TEST 9 | user B MCP authorize for user A project refused | PASS | oauth 400, B workspace list clean |
| TEST 9 | user A session restored | PASS | user A back |
| TEST 10 | malicious approved patch deployed to preview sandbox | PASS | storage/parent/cookie blocked, 0 privileged calls, runtime_error surfaced |
| TEST 10 | terminal rejects shell/network/secret commands | PASS | curl/dotenv/parent-path all 400 |

## Harness change disclosure

- tests/observability.test.ts: the retention test received an explicit 30s vitest timeout (default 5s) and now writes its 1010-row D1 telemetry fixture in chunks of 101, because the single 1010-statement batch intermittently broke the workerd socket on this container (UND_ERR_SOCKET, 2 of 3 runs). Identical retention assertions; test code only, no product code changed.
- scripts/e2e-scenarios.mjs is new in Part 23 (TEST 1-10 harness, writes e2e-results.json).
- scripts/qa-run.mjs, QA.md, qa-results.json, qa-report.html are new in Part 23.

## NOT RUN and honest limits

- Live AI model generation (TEST 2) and AI-generated repair (TEST 3): NOT RUN - no AI provider key on a free-only stack. Verified instead: both endpoints fail closed with 503 ai_provider_not_connected / repair_ai_provider_not_connected, and the validated patch path + real browser build were exercised with equivalent fixtures.
- Public internet deployment (TEST 7): NOT RUN - workers_dev/custom domain unavailable free-only. Verified instead: pinned release deployed to a local HTTP target with a real health check and byte-exact served content.

## How to run the 3 NOT RUN steps after Cloudflare access is cleared

All three need one external unlock: a Cloudflare account past human verification (free tier is enough). After that:

1. TEST 2 (live AI generation) and TEST 3 (AI repair): enable Workers AI on the Cloudflare account. In the control worker config (wrangler.jsonc) add the AI binding (ai = { binding = "AI" }) and set AI_REPAIR_ENABLED=true - the repair planner only activates when both are present (model @cf/qwen/qwen2.5-coder-32b-instruct via WorkersAIProvider, same gate on the generation endpoint). Mirror the same binding in the Miniflare bindings block inside scripts/e2e-scenarios.mjs so the local harness reaches it, then rerun: node scripts/e2e-scenarios.mjs. The two steps flip from NOT RUN to real executions of POST /api/projects/:id/ai/request and the repair propose flow.
2. TEST 7 (public app): on the cleared Cloudflare account deploy the deployment-target worker for real: npx wrangler deploy --config deployment-target/wrangler.jsonc (gives a workers.dev URL or attach a custom domain). Set DEPLOY_MODE=public and DEPLOY_ORIGIN=https://<that-public-url> in the control worker vars, mirror both in scripts/e2e-scenarios.mjs, then rerun: node scripts/e2e-scenarios.mjs. The publish step then targets the public URL and the health check runs against the public app over the internet.
3. After any of these flips, regenerate this report from actual output: node scripts/qa-run.mjs e2e && node scripts/qa-run.mjs report. Rows update only from recorded executions.
- Responsive/accessibility results come from emulated Chromium viewports (360/390/412/1440), not physical devices.
- qa-report.html rendered and screenshotted at 360px and 390px as the results-view evidence.

## Reproduce

npm install && npx playwright install chromium && node scripts/qa-run.mjs all

Individual stages: node scripts/qa-run.mjs static|unit|scripts|e2e|report. Results persist in qa-results.json; report stage regenerates this file and qa-report.html.
