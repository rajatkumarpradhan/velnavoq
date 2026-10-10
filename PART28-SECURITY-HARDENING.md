# Velnavoq - Part 28: Security Gap Hardening (MFA, Account Recovery, Idle Timeout, Edge/TLS, Egress)

- **Date:** 10 October 2026
- **Base:** Part 27 source state (Part 27 changed files applied and hash-read from GitHub main before editing)
- **Scope:** close the five named open gaps from the Part 26 audit and Part 27 report: MFA, account recovery, idle timeout, edge/TLS posture, egress controls.
- **Environment:** Node v22.23.3, miniflare (workerd) + local D1, vitest. Everything local; no Cloudflare account touched, nothing deployed, no paid service.

## What was built (real code, executed)

### 1. MFA - TOTP (RFC 6238) with recovery codes
- `src/mfa.ts`: HMAC-SHA1 TOTP, 6 digits, 30s step, ±1 window; base32 secret; `otpauth://` enrollment URL.
- Secret custody: AES-GCM encrypted with the operator `SECRET_STORE_KEY`, AAD-bound to user id and key version. Enrollment **fails closed 503** `mfa_secret_storage_unavailable` when custody is unconfigured (tested with a keyless Worker).
- Login flow: correct password on an MFA account returns **401 `mfa_required`** with a 5-minute challenge token - no session is issued. `POST /api/auth/mfa/verify` completes sign-in. A challenge dies after **5 wrong codes** (`mfa_attempts_exhausted`) and is burned on success.
- Replay protection: a TOTP from an already-consumed timestep is rejected (`last_step` monotonic per account). The activation code's timestep is consumed at activation.
- Recovery codes: 8 one-time codes (`xxxx-xxxx`), SHA-256 hashed at rest, burned on use, regenerable only with a live TOTP. They are the lost-factor path.
- Disable: requires current password **and** a live TOTP or recovery code; terminates every other session atomically, current session survives with its fresh proof.
- UI: sign-in screen handles the `mfa_required` step (code or recovery code); account security panel enrolls (secret shown once), activates (issues codes once), regenerates and disables.

### 2. Account recovery - password reset
- `src/account-recovery.ts`: single-use, hashed, 30-minute reset tokens. Request endpoint answers **identically** for known and unknown accounts (no enumeration) and is capped per account per hour (3) plus per-IP rate limit.
- Reset: validates token + `validateNewPassword`, rotates salt/hash, revokes **all** sessions and pending MFA challenges, clears the failed sign-in lockout, burns the token, and uses the `password_change_guard` trigger so a concurrent password change aborts the whole batch.
- **MFA is never bypassed**: an MFA account that resets its password still must complete the second factor at next login (tested).
- Delivery: free stack has no email provider, so tokens are written to a local development outbox table (`recovery_outbox`). Production email delivery is **NOT RUN**.
- UI: "Forgot password?" request and token+new-password reset screens on the sign-in route.

### 3. Idle session timeout
- `sessions.last_seen_at` added (migration 0020). Server-side policy: **30 min inactivity / 24h absolute**. Idle-expired sessions are deleted and rejected with 401 `session_idle_expired`. Activity slides the deadline, throttled to one write per 60s. Pre-migration rows (`last_seen_at=0`) fall back to `created_at`. `/api/me` exposes `idleTimeoutSeconds`.

### 4. Edge/TLS posture
- Every control-plane response now also carries `cross-origin-opener-policy: same-origin`, `cross-origin-resource-policy: same-origin`, `origin-agent-cluster: ?1` (on top of existing `content-security-policy: default-src 'none'; frame-ancestors 'none'`, `nosniff`, `no-referrer`, `no-store`). Verified on success **and** error responses, and HSTS (`max-age=31536000; includeSubDomains`) only over TLS.
- Honest boundary: Workers TLS termination and minimum-TLS version are platform/zone settings; no account change was made, so zone-level TLS configuration is **NOT RUN** (operator dashboard checklist).

### 5. Egress controls
- `src/egress.ts`: deny-by-default policy for every server-side outbound URL. `ai-provider`: https only, exact host allowlist (`api.openai.com`), no IP literals, no userinfo, no non-default ports, no internal/metadata hosts. `deployment-health`: URL origin must equal the operator-pinned `DEPLOY_ORIGIN` binding exactly; https required for non-local targets.
- Wired into the two real egress sinks: `src/ai-adapters.ts` (OpenAI endpoint assertion) and `src/deployment.ts` (health-check URL assertion). The Workers AI binding runs in-process (no egress). A test guards that no other `src/` file gains an unaudited `fetch(`.

## Evidence (all executed in this run)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` (wrangler dry-run builds + vitest) | **24 files / 451 tests PASS, 0 fail** (428 pre-existing + 23 new) |
| `tests/part28-security.test.ts` | 23/23 PASS: enroll/activate, wrong-code denial, challenge-not-session, TOTP sign-in, replay denial, attempt burn, recovery-code single use, disable semantics, regeneration, fail-closed custody, idle expiry/slide/legacy fallback, recovery enumeration-safety, reset + revocation + token burn, malformed/expired tokens, per-hour cap, no-MFA-bypass, lockout clearing, egress allow/deny units, fetch-path audit, edge headers on success + error |

Bugs found and fixed while building (self-found, before claiming): workerd requires an explicit HMAC hash import parameter (initial 500 on activate); recovery rate-counter window units misaligned with quota sweep; one pre-existing test fixture (observability) inserted a 1970-dated session that the new idle timeout correctly expired - fixture corrected to current time.

## Sach: limits, honestly

- **NOT RUN:** production email delivery of reset tokens (no provider on the free stack; local outbox only). Zone-level TLS/HSTS configuration (no account changes permitted). Real public-identity verification (login is still localhost-only by design - `production_identity_not_configured`). A live AI provider call through the egress-guarded path (no key; the guard itself is unit-tested).
- TOTP is HMAC-SHA1 per the widest authenticator-app support; codes are 6 digits with ±1 window, the documented trade-off.
- The recovery outbox means anyone with local D1 access can read reset tokens in development; this is a development-only delivery mechanism and must be replaced by a real email provider before public launch.
- ASVS self-assessment (L1+L2) after this part: **78 pass / 14 fail / 58 N/A / 103 not verified**. Still no level achieved; this is a self-assessment, not a certificate.
- Public signup remains closed and nothing was deployed.
