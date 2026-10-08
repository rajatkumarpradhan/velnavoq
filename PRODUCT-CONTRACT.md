# Velnavoq: Part 0 product contract
by Drayvenn Lab | 9 October 2026 | Version 0.1

## Product and core user
An AI-native web development platform that turns a user's instructions into inspectable project files, verified builds and approved live releases. This is the intended product, not a claim that these capabilities exist today.
Core beta user: an invited university student or individual web builder making a college project or non-sensitive small web app. Mobile review should work on Rajat's OnePlus; code-heavy work can use a laptop. No public launch until security/runtime gates pass. Exact invite counts, account limits and operational quotas are not decided.

## Benchmark findings, not copied design
- Replit documents plan/build/review/testing and recoverable checkpoints. Velnavoq needs an inspectable change history, real test evidence and safe recovery [1,2].
- v0 documents incremental full-stack development with persistence/API integrations. Velnavoq must distinguish generated UI from working backend capability [3].
- Bolt documents project/file management and source download. Builders need ownership, inspection and source portability [4].
- Lovable documents GitHub synchronization. Version history/export must be a real integration, not an icon or fake success [5].
These are vendor-documented capabilities, not hands-on comparative quality tests. No competitor UI, branding or source is copied.

## Primary use cases and journeys
1. Create: sign in -> choose workspace -> create project -> describe app -> review plan and supported stack -> AI draft -> real build/test -> inspect files/errors/preview -> approve exact changes -> publish after health checks.
2. Change: open project -> request or edit a change -> immutable versioned proposal -> real build/test -> inspect diff and preview -> approve/reject -> release, with safe retry.
3. Repair: inspect failed job and real logs -> scoped AI patch -> rerun checks -> review -> approve. Never replace failures with simulated success.
4. Recover: inspect approved release history -> choose known release -> preview/check -> confirm rollback. Database rollback needs a separately tested recovery path.
Current local code supports only sign-in, workspace/project creation/list/read, stored source proposals and transactional approval. The AI/build/preview/publish/repair/recovery portions above remain unavailable.

## Scope and priorities
| Priority | Capability | Delivery scope | Actual state |
| --- | --- | --- | --- |
| P0 | Reproducible source/config/contracts/migrations | Secure foundation | Implemented and locally tested |
| P0 | Identity, sessions, tenant/role checks, persistence | Secure foundation | Local password flow tested; production identity/invites blocked |
| P0 | Version/digest-bound atomic approval and audit | Secure foundation | Stored static bundles tested; generated schema unsupported |
| P0 | Isolated execution, no parent secrets, egress/quotas | Required before runnable MVP | BLOCKED: no verified free hosted runner |
| P0 | Persistence recovery, abuse/body/file limits | Secure foundation | Local restore/basic limits tested; remote recovery/abuse review pending |
| P1 | Mobile shell, project/file editor, real job logs | Serious beta | NOT IMPLEMENTED |
| P1 | AI provider adapter, scoped coding/repair loop | Runnable MVP/beta | NOT IMPLEMENTED: no verified authorized provider |
| P1 | Real tests/build, separate-origin preview | Runnable MVP/beta | NOT IMPLEMENTED, depends on runtime |
| P1 | MCP/OAuth scopes/revocation, secrets handling | Serious beta | NOT IMPLEMENTED |
| P1 | Immutable deployment, health checks, rollback | Runnable MVP/beta | NOT IMPLEMENTED |
| P1 | Team access, monitoring, remote backups, a11y/performance | Serious beta | NOT IMPLEMENTED |
| P2 | Additional frameworks/providers, broader scale | Expansion after proven first stack | NOT IMPLEMENTED |

MVP: one supported runnable web stack, authenticated project/workspace system, real files, one verified AI path, bounded build/test, real preview, exact approval, publish and rollback. This minimum is not met yet.
Beta: invited users only, mobile-accessible editor/review, real logs, scoped MCP, secret handling, tested backup/restore, abuse controls, end-to-end failure/cancellation coverage and known quotas. Beta does not mean production readiness.
Production: security/accessibility/performance review, verified tenant/job isolation, reliable identity recovery, alerting, incident/deletion/retention policies, tested disaster recovery and supported-stack end-to-end acceptance. Free quotas and no uptime guarantee must be visible; do not promise enterprise reliability on Free.
Future: broaden frameworks and integrations only after runtime, licensing, cost and security tests prove them.

## First stack decision and runtime gate
Selected initial source contract: static-web-v1, HTML/CSS/JavaScript with relative files; no npm dependencies, package scripts, backend execution or generated DDL. Source can be reviewed, validated, stored and approved using implemented P0 code. Limit: 50 files, 500,000 total UTF-8 bytes. This is a staged source contract, NOT a claim that a real runtime has been proven or that a static frontend satisfies the full product.
Why first: it removes dependency-install and shell-execution risk while auth/persistence/approval is verified. Proposed first preview uses a separate-origin sandbox without control-plane secrets; proposed publish serves immutable approved artifacts. Neither preview nor deployment is implemented. A runnable stack is not approved until actual build/test, network/isolation and hosting tests pass.
Compared runtime approaches: Containers/Sandbox provides actual dependency/build execution but is not available on Workers Free [6]. Dynamic Workers is also Paid [7]. Browser WebContainers is a genuine Node environment but commercial production licensing is required [8]. MIT almostnode is free browser-local software but explicitly experimental/Node emulation, not a verified production sandbox [9]. Personal Codespaces has limited no-card free quota, not a proven platform-wide runner [10]. No paid feature/account/license has been activated. Do not silently replace real backend requirements with static hosting.

## Lifecycles: required states, not fake progress
- Project: draft -> active -> archived -> deletion-requested -> deleted. Current: create/list/read only; archive/delete not implemented.
- AI: queued -> running -> patch-proposed -> completed, failed or cancelled. Current: NOT IMPLEMENTED. Only actual provider events may advance state.
- Build: queued -> installing -> building -> testing -> succeeded, failed, cancelled or timed-out. Current: BLOCKED. Static stack may skip install; it must still run real checks.
- Preview: unavailable -> starting -> ready -> failed/expired/stopped. Ready requires artifact/runtime reachability, never a screenshot.
- Deployment: draft -> checks-passed -> approved -> publishing -> healthy -> live, failed or rolled-back. Publish cannot precede health evidence.
- Approval: pending -> approved or rejected. Base version, exact files/schema/permissions and digest bind approval. Stale change conflicts; retry cannot duplicate effects. Current: exact stored files, empty schema/permissions only.
- MCP: disconnected -> registered -> consent-pending -> connected/scoped -> revoked/expired. Exact redirect/PKCE/audience/scope/expiry/revocation required. Current: NOT IMPLEMENTED.
AI/build/preview/deploy/MCP state machines are product requirements only. Foundational config reports unavailable features as false; no job simulator is added.

## Explicitly unsupported
Universal frameworks; native Android/iOS publishing; arbitrary shell or npm jobs without a proven isolated runner; health/payment/government-ID data; automatic spending or paid signup; unreviewed schema/destructive changes; fake terminal/model/build/deploy/MCP output; enterprise uptime claims. Production signup, email verification/recovery, team invites, remote secret storage, live hosting and remote backups remain unimplemented, not silently supported.

## Acceptance gates
A. Foundation: clean reconstruction from committed source/lockfile passes typecheck, tests and dry-run build; no credentials required or committed. PASS locally.
B. Identity/isolation: cross-tenant reads/writes denied, viewer cannot mutate, CSRF/origin checks, expiry/revocation pass. PASS locally; live production auth and Free CPU suitability UNVERIFIED.
C. Approval: exact digest/version, immutable proposal, reject leaves source unchanged, stale denial, replay and injected partial-failure rollback pass. PASS for supported stored source bundles.
D. Recovery: local backup restores exact SQL plus integrity/foreign-key checks. PASS locally; encrypted remote restore NOT IMPLEMENTED.
E. Runnable MVP: real provider patch -> dependency/build/test -> separate-origin preview -> review -> approved publish -> health check -> rollback. BLOCKED / NOT IMPLEMENTED.
F. Beta/production: ASVS review, scoped OAuth/MCP, mobile/keyboard/a11y checks, runtime egress/timeouts/cancellation, costs/quotas, alerting and disaster recovery all verified. NOT IMPLEMENTED.

## Part 0 implementation only
PRODUCT-CONTRACT.md records scope. src/product.ts holds immutable identity, true/false availability, initial stack contract, implemented limits and no-spend/data policies. tests/product.test.ts checks identity and truthful unavailable flags. No unrelated feature is added. Existing P0 work remains recorded separately.

## Sources (checked 9 October 2026)
[1] https://docs.replit.com/learn/build-with-agent
[2] https://docs.replit.com/features/version-control/checkpoints-and-rollbacks
[3] https://v0.app/docs/full-stack-apps
[4] https://support.bolt.new/building/using-bolt/projects-files
[5] https://docs.lovable.dev/integrations/github
[6] https://developers.cloudflare.com/containers/platform/pricing/
[7] https://developers.cloudflare.com/dynamic-workers/llms-full.txt
[8] https://webcontainers.io/enterprise
[9] https://almostnode.dev/
[10] https://docs.github.com/en/codespaces/overview
