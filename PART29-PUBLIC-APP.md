# Part 29: public app (UI on a public link, real identity, recovery email)

Status labels: PASS = ran here and passed. NOT RUN = needs the live deploy or secrets that were not available.

## What changed
- **UI served from the Worker project** (Workers static assets, free): `wrangler.jsonc` now has `assets` (`./ui-dist`, SPA fallback). `/api/*`, `/oauth/*`, `/mcp*`, `/.well-known/*` still run the Worker first. `ui/public/_headers` adds CSP, HSTS, nosniff, no-referrer, frame denial for the static pages. `npm run build` now builds the UI first.
- **Public identity without a server-side password KDF**: the browser runs PBKDF2-SHA256 (600k) and sends a 256-bit verifier; the Worker stores SHA-256(salt:verifier). This avoids PBKDF2 CPU in the Worker (Workers Free is 10 ms CPU per request). Offline guessing cost for an attacker is unchanged (600k PBKDF2 per guess). Trade-off: the common-password blocklist is enforced in the browser, not on the server. Endpoints: `POST /api/auth/kdf` (salt, unknown emails get a stable pseudo-salt), `register`/`login` accept `{email,verifier[,salt]}`. Legacy `{password}` login still only works on localhost.
- **MFA, idle timeout** (Part 28) now work for these accounts: login returns `mfa_required` before any session; MFA disable and password change accept verifiers. Server idle timeout 30 min (tested). The UI signs out after 30 min of no activity and sends a keep-alive while active.
- **Signup gate**: `REGISTRATION_ENABLED=false` stays. Optional `SIGNUP_ALLOWLIST` (comma emails) lets named people register while public signup is closed. It is empty by default.
- **Recovery email**: `src/mail.ts` sends the reset link through the Brevo transactional API only when `BREVO_API_KEY` and `MAIL_FROM` are configured. The endpoint host is pinned by the egress policy (`api.brevo.com`). Without them the UI says plainly that reset email is not switched on, and no token is stored. Reset link format: `APP_ORIGIN/#signin?reset=<token>`; the page removes the token from the address bar after reading it.
- **UI**: one blue theme, new landing page, sign-in/sign-up/recovery/reset screens, workspace onboarding for new accounts, light CSS-only animation (no blur), reduced-motion respected.
- Migration `0021_public_identity.sql` (tables `user_kdf`, `auth_config`).

## Tests
- `tests/part29-public-identity.test.ts`: 15 tests, PASS (signup gate, hashed storage, real browser-side derivation round trip, pseudo-salt, identical failures, origin/host checks, lockout, MFA, idle expiry, recovery via a captured mail request, no-mail honesty, egress allowlist, password change, MFA disable).
- Full suite `npm test`: 25 files PASS (includes the deploy agent's `ai.test.ts` from main).
- Browser run on a 412x915 mobile viewport (Chrome, local wrangler dev with assets): signup, workspace onboarding, project create, AI/files/preview/deployment screens (no horizontal overflow), account page, password change, wrong password, recovery request, reset via link token, new login. No console errors except expected 401s. Screenshots in the attached ZIP.
- Real PBKDF2 timing in headless Chrome: signup to dashboard about 0.9 s, login about 0.4 s. NOT MEASURED on the OnePlus.

## NOT RUN
- Live deploy, live URL check, `CF-Connecting-IP` behaviour on the real edge.
- Real email send (no Brevo key set; tested against a captured request only).
- Workers AI generation from the UI on the live site.
- Custom domain (token has no zone permission).

## Deploy notes
- Set `APP_ORIGIN` to the exact public https origin (no path, no port) when deploying, for example `--var APP_ORIGIN:https://velnavoq-control.<account>.workers.dev`. The Worker answers identity requests only when the request host equals it.
- `workers_dev` is now `true` (preview URLs off). Keep `REGISTRATION_ENABLED=false`.
- Apply migration 0021. Build UI before deploy (`npm run build` does it).
- Optional later: secrets `BREVO_API_KEY`, var `MAIL_FROM`, var `SIGNUP_ALLOWLIST`.
