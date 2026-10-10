# Part 27 - final real end-to-end user test

Executed Saturday, October 10, 2026, 12:35-12:52 IST. Environment: local workerd (Miniflare) + D1, built production UI served by `vite preview`, emulated Chromium, two-host preview (separate origin), local HTTP deployment target. Every step below was actually executed against the real running system. Steps that could not be executed against the real thing are labelled NOT RUN with the exact reason. Nothing is marked PASS that was not run.

Fixtures are labelled as manual fixtures, NOT AI output. The SSE AI binding used in unit tests is labelled a test double, not a real model. Viewports are emulated Chromium at 360px and 390px, not physical devices.

## Final verdict

**PARTIAL.** All 32 locally executable steps PASS, 0 FAIL. 3 steps are honest NOT RUN: real AI generation, real AI repair, and the authenticated public deploy pipeline. These are blocked by missing external access (real Workers AI binding) and by an intentional production identity gate, not by test failures.

## Results table

| Test | Result | Steps |
| --- | --- | --- |
| TEST 1 - account, workspace, project via real UI | PASS (4/4) | Account registered through the real UI with session issued; workspace `0aa0ddb7-1d76-4f73-884b-f1d65797620a`; project `7a562413-c1f1-43e6-9737-a48811a49022`; public registration/login gate retained (non-localhost 503, no bypass). |
| TEST 2 - realistic app request, files, review, build, preview | PARTIAL (4 PASS, 1 NOT RUN) | Realistic request submitted through the new AI request form: actual `/agent/run` returns 503 `agent_provider_not_connected` (fail-closed, verified real). AI model file generation: NOT RUN, no real Workers AI binding available; the fixture used below is manual, NOT AI output. Fixture `hello.html` approved through the real review/approve UI at revision 2. Real browser build succeeded. Two-host preview rendered the built app on a separate origin. |
| TEST 3 - intentional bug, real diagnosis, repair | PARTIAL (4 PASS, 1 NOT RUN) | Intentional syntax error injected and approved. Build failed for real with exit 1 and the real diagnostic `JavaScript syntax: app.js: Unexpected token (1:6)`. Repair session created bound to the failed build job; the diagnostic is present verbatim in the repair evidence. Propose step fails closed with 503 `repair_ai_provider_not_connected` (verified real). AI repair generating the fix: NOT RUN, no repair AI provider connected (free-only constraint). Manual corrective patch applied through the review path; rebuild succeeded; preview reopened. |
| TEST 4 - editor save, rebuild, artifact | PASS (3/3) | Editor save created auto-approved revision 5; build after editor save succeeded; the built artifact ZIP contains the edited `hello.html`. |
| TEST 5 - MCP scoped authorize, execute, revoke | PASS (3/3) | MCP client registered and authorized through PKCE consent for scope `project.read` only; token issued. Authorized `velnavoq.project` tool call returned the exact project. Token revoked; further calls return 401. |
| TEST 6 - protected environment variable | PASS (2/2) | Masked `SERVICE_TOKEN` created; build succeeded. Canary value absent from the environment API response, the build log, the downloaded artifact ZIP, and the agent context. |
| TEST 7 - release, deploy, health | PARTIAL (3 PASS, 1 NOT RUN) | Immutable source release v1 pinned. Deployed to the local HTTP target with a real health check; served release bytes match the published bytes at `http://127.0.0.1:5192/r/ca1b62d7-fb63-42f9-b03d-514ea6b145a8/index.html`. Public app on the internet: NOT RUN - the authenticated public pipeline has never been verified; production identity is intentionally disabled; the prior health-only worker deployment does not verify this pipeline. |
| TEST 8 - bad release, rollback | PASS (2/2) | A second (bad) release was deployed and confirmed live at the target. Rollback repointed routing to the known-good bytes; served artifact digest `7c1928123814e3bdef6fafae1a8d9154d464ade130ad884ab311327d99a47245` restored exactly. |
| TEST 9 - cross-tenant and cross-workspace denial | PASS (5/5) | Second user B registered in a separate tenant. Every user B access to user A's project denied 404 (read project, inject patch, read versions, read environment, start build). User B's MCP authorize for user A's project refused with OAuth 400; B's workspace list clean. Cross-workspace access denied 404 in both directions with actual second project/workspace IDs. User A session restored. |
| TEST 10 - malicious generated code | PASS (2/2) | A malicious approved fixture was deployed to the preview sandbox. It attempted control-plane `/api/me` and environment reads, the exact other project `25b31df8-3488-4698-9bda-376c53e99e21`, the exact other workspace `985b192b-18a5-4d2c-bf47-5f7fe461430e`, and `https://blocked.example.invalid/exfil`. CSP `connect-src 'none'`; storage, parent-document and cookie access all blocked; 0 outgoing privileged/network requests observed; the runtime error was surfaced to the parent page without the parent being rewritten. Terminal rejected `curl`, `cat .env` and `cat ../secrets` with 400. |

## Failures found, fixed, and rerun

| Failure | Fix | Rerun |
| --- | --- | --- |
| First E2E run: TEST 10 terminal step failed - `cat .env` was not denied (429 rate limit from prior steps made the denial check read a limited response). | Harness waited to the next minute boundary before the terminal step so the write-rate limit window reset. | Run 2+: terminal step PASS (curl/dotenv/parent-path all 400). |
| Reruns 3-4: TEST 1 workspace step timed out (30s) - a Playwright text selector matched a hidden `<option>` element before the visible `.page-title`. | Selector scoped to `.page-title`. | Run 5: full PASS, 32 steps. |

Both the original failure and the fixed rerun are recorded: `/tmp/p27-e2e.log` (failure) and `part27-results.json` (final run, generated 2026-10-10T07:18:35Z, finished 07:20:01Z).

## Implementation gap found and fixed (parent-approved)

The Part 25 source's claim that adding a Workers AI binding alone enables generation was false: `/api/projects/:id/ai/requests` and `/api/projects/:id/agent/run` were unconditional 503s and the AI workspace had no request form. Fixed locally, fail-closed, with tests:

- New `src/generation.ts`: review-only proposal generation via EnginePlanner/WorkersAIProvider. Fail-closed 503 without an AI binding plus `AI_REPAIR_ENABLED=true`; enforces stale-snapshot rejection, secret-bearing instruction rejection, per-project token budget requirement, operator AI freeze, and cross-tenant identity checks. Model output creates review-only proposals; it never applies changes directly.
- Wired into `src/coding-agent-api.ts` (`/agent/run`) and `src/ai-api.ts` (`/ai/requests`), replacing the unconditional 503s.
- New `ui/components/project-agent.tsx` AI request form; toggle and route registered in `ui/main.tsx`.
- `src/quota.ts`: both generation routes now spend `proposals.day` and gauge `storage.bytes.project`.
- New `tests/generation.test.ts`: 10 tests, all PASS, using a clearly labelled SSE binding double (not a real model).
- `QA.md` corrected (new "Correction from Part 27" section): the bindings claim was wrong; no Cloudflare change is authorized by that document.

## Full verification totals

- `npm run check`: typecheck PASS, **427 tests across 23 files PASS**, `npm audit` 0 vulnerabilities.
- UI checks: **254 layout/a11y/command-navigation checks PASS** across 30 screens; axe 0 violations at 390px; touch targets meet WCAG 2.2 AA at 390.
- Quota evidence: **12 PASS / 0 FAIL**.
- Generation tests: 10/10 PASS.
- Worker dry-run build PASS: bindings DB (D1), AI, APP_ORIGIN, REGISTRATION_ENABLED=false, RUNTIME_ENABLED=false, AI_REPAIR_ENABLED=false; total upload 773.59 KiB.

## NOT RUN items and what unlocks them

1. **Real AI generation from a prompt** - needs a real Workers AI binding on an authorized account, `AI_REPAIR_ENABLED=true`, and a project token budget. The fail-closed path and the full proposal plumbing are verified with a labelled test double.
2. **Real AI repair** - same requirement; the repair session, evidence binding, and fail-closed propose path are verified.
3. **Authenticated public deploy pipeline** - needs the production identity gate (public registration/login) to be implemented and approved. This was deliberately kept intact per instruction; it is a Part 28 decision. The prior live health-only worker deployment does not verify this pipeline.

## Correction to the prior audit summary

The earlier summary claiming the public deploy "never ran" was inaccurate in the other direction: a health-only worker deployment (`velnavoq-control`, `velnavoq-static-releases`) did happen on the owner's free account. What remains NOT RUN is the authenticated project/build/deploy pipeline end to end, which the health-only deployment does not exercise. This report uses the corrected statement.

## Evidence

- `part27-results.json` (in repo): machine-recorded per-step results from the final run.
- E2E final run log: `part27-final-run.log`. First failed attempt: `part27-first-attempt.log`.
- Full check log: `part27-check.log` (427/427 PASS, 0 vulnerabilities).
- Screenshots at 360px and 390px for every UI step (`part27-*.png`): signup, workspace, project, AI request, every review/approve dialog, build, preview, intentional error, repaired preview, MCP authorized/revoked/callback, environment, rollback, malicious preview. Key screenshots visually inspected.
