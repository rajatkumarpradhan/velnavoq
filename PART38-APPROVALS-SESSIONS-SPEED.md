# Part38: Approvals arrive, persistent sign-in, faster entry

## Approval inbox

Owner-only compact GET /api/approval-inbox returns pending source proposals across owned projects, account project requests and connection consents. No source or bearer tokens. Limits100 source/100 request/20 consent, count marked+ when limited. Auth/role filtering and expiration/revoke checks remain. While app visible/online,10s polling; no hidden/offline checks, immediate return check, error backoff20/40/80/120s, stop on401/403. Changes refresh lists in place without resetting editor buffers or selected consent grants. Header banner from any page goes directly to single exact source card or account MCP cards, chooser when several. No approval directly from unexplained banner. Existing digest/review/CSRF gates unchanged.

## Sign-in

Confirmed source root cause:24h persistent cookies existed, but30min server idle expiry and29.5min UI logout invalidated closed/background sessions. Strict cookie blocked cross-site OAuth navigation. Remove idle auto-logout;30day persistent Secure/HttpOnly session, Lax cookies with existing exact Origin/CSRF for writes. Daily rotation via CSRF POST renew, same CSRF secret to preserve concurrent tabs, old token30sec alias grace; revoked sessions cascade aliases. Password/signout/revoke remain effective. Renew on visible startup/return and6h visible cadence, no session secret in JS. Local OAuth flow session binding follows rotation. Migration0029 creates aliases/index and extends currently unexpired sessions30days; already deleted/expired sessions cannot be restored.

Regular use keeps login alive, not a literal forever promise:30day absence, cookie clearing, private browsers, isolated Grok webviews, account revocation and password change can require login. Session expiry remains enforced. No MFA bypass.

## Speed and preview

Lazy entry home/auth/identity/workbench; authenticated shell ready after me rather than waiting for workspaces. Project MCP's six independent reads parallel rather than sequential. Existing hashed-assets1year immutable and HTML no-cache headers retained. No extra paid services/AI; inbox reads add free-plan usage, not unlimited cost proof.

Controlled local built dashboard fixture at390px,4x CPU,150ms network latency,200KB/s transfer,300ms mocked API: before3423ms vs after2955ms, JS transfer276773 vs262956 bytes, requests4 vs7; a single sample, not statistically stable or real phone/production latency. Entry raw JS276473-ish to251240 bytes, gzip77.4KB after (build output authoritative). No live Cloudflare cold-start or user's phone waterfall measured; no claim of production speed guarantee.

Overview now has Live Preview button. Opens current project's preview screen; Create preview still requires a successful current saved-revision build and configured separate preview host. No fabricated preview or automatic paid build. Existing sandbox constraints remain.

## Deploy

Apply0029 after0028 before control/UI deploy, preserve signup/bindings/adapters. No target Worker change. Test daily rotation/signout/revoke and old alias expiry; background no poll; new source and account requests auto-banner/card, no edits reset; overview preview entry. Mobile evidence synthetic local fixture, not real user proposal action. Full production free CPU/query volume remains unmeasured.

Mobile action simplification: project overview Preview / Publish / Approvals are primary actions, Files/AI workspace remain. Build logs/releases/rollback/delete behind Advanced project settings. Preview added to actual mainRoutes sidebar (earlier all-routes inspection misidentified a mobile menu entry). Publish opens existing deployment flow, not one-tap spend/release. Part39 candidate: guided build-current-revision then preview, and review/publish one outcome card with prerequisites and failure repair; don't hide unresolved build/backend safety gates or call them already simplified.
