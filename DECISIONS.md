# P0 decisions, 9 October 2026

## Runtime trust boundary
Control API never imports, evaluates or executes generated code. App bundles are immutable data only. A separate runtime origin and per-job isolation, network policy, timeout/cancel, quota and no-control-secret boundary remain required. Runtime is disabled, not simulated.

Compared options: Cloudflare Sandbox/Containers offers a real OS build environment but requires Workers Paid; Dynamic Workers offers isolated code execution but also requires Paid. No purchase authorized. Static bundles are an initial source contract, not a declaration that static hosting satisfies the requested real app builder.

https://developers.cloudflare.com/containers/platform/pricing/
https://developers.cloudflare.com/sandbox/sdk/platform/pricing/
https://developers.cloudflare.com/dynamic-workers/llms-full.txt
https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/

GitHub Codespaces includes personal free quota without payment details; account entitlement and spend configuration not checked. Suitable candidate for owner's limited development, not assumed production multi-tenant runner. WebContainers commercial production needs a license. almostnode is MIT but experimental, emulated browser Node, not verified as secure production execution.

https://docs.github.com/en/codespaces/overview
https://webcontainers.io/enterprise
https://webcontainers.io/guides/browser-support
https://github.com/macaly/almostnode
https://almostnode.dev/

## Persistence and approval
D1 batch for workspace+membership creation. Single transactional SQL trigger for proposal status, exact source, revision and audit. Rejection performs no release writes. Generated DDL is not executed. Digest checked in API, payload immutable in DB, owner membership rechecked inside approval trigger. Compared application-side multiple writes with transactional DB enforcement; chose transactional enforcement to prevent partial release.
https://developers.cloudflare.com/d1/worker-api/d1-database/

## Authentication
Local email/password provides actual session/authorization testing without inventing OAuth success or creating a new OAuth client. PBKDF2 SHA256 600,000 iterations matches OWASP fallback guidance, but cannot be assumed affordable within Free CPU budget. Registration closed by default. Production identity/provider choice remains a gate; no paid hash service or policy enrollment activated.
https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
https://developers.cloudflare.com/workers/platform/limits/

## Scope and launch gates
No existing data restored. No hidden local credential dependence. No backend project secrets stored in app files. No health/payment/ID-data support claim. Student beta/access policy, backup encryption/remote recovery, invite/email verification, authenticated app preview, physical handset performance, full ASVS review and final launch tests remain open.
