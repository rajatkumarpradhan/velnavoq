# Velnavoq environment and secrets

Part 16, 10 October 2026. Source and local tests implemented. No production key, real credential, cloud resource, token, account policy or paid service was created. Cloudflare verification and production login blockers are unchanged.

## Management

Owner-only Environment and secrets screen and /api/projects/{id}/environment API support project defaults plus development, preview and production entries. Exact name/environment pairs are unique. Names are uppercase identifiers; reserved control, Cloudflare, Vite and key-binding prefixes are denied. Values are bounded to 4 KB, at most 50 entries/project, and management is rate-limited to 20 requests/minute/IP plus session write limits.

Both variable and secret values are intentionally encrypted and write-only. Browser responses return constant [masked] plus name, kind, environment, entry version, key version and lifecycle times. No length hint, partial last characters, ciphertext, raw value or decrypt/reveal endpoint. Form uses a password input and clears on submission, including failed requests; no local/session storage. The browser necessarily handles the value that the owner enters and the outgoing request; write-only means no server reflection or later read-back, not that the owner's own browser cannot see its input.

Create, replace/rotate and delete are bound to entry/project/version, current owner membership, Origin/CSRF and audit. D1 batches commit value changes and lifecycle audit together. Version conflicts and a unique entry/version audit prevent concurrent stale rotation. Deletion clears current ciphertext and retains masked tombstone/metadata. Deleted names cannot be silently revived; choose a new entry. This does not erase provider copies, prior D1 backups or memory. No provider API is called to rotate/revoke an actual upstream credential: the owner must rotate at the issuer first and enter its replacement. Values are never sent to another provider by management.

## Key custody

AES-256-GCM uses random 96-bit nonces and authenticated data binding project, entry, name, environment, kind, value version and key version. SECRET_STORE_KEY must be a 32-byte hex key supplied as a server secret binding, with SECRET_STORE_KEY_VERSION. Neither is configured in Wrangler vars, Git, browser output or generated code. Missing/invalid key custody fails closed. Tests use only obvious synthetic fixture keys and canaries, not credentials.

Production would need the user to provision the binding through a secure channel after deployment access is clear. No request for a real key is needed to finish this source part. No managed KMS/HSM, automatic encryption-key rotation, recovery keyring or old-key re-encryption job is implemented. Changing the key version without re-entering values makes older values unavailable rather than guessing/decrypting with another key. The controller can decrypt values in memory; database-only encryption does not protect against a compromised controller or an attacker who obtains the key too.

## Injection boundary

Current free static-web-v1 build, QuickJS/browser runtime and preview are untrusted/browser-visible. They receive **zero** protected environment values. POST environment/injection denies all browser/build/preview/AI requests and records a metadata audit. No environment value is embedded in HTML/JS, ZIPs, source exports, generated files, AI context, MCP metadata or preview URLs. No hosted trusted runtime exists, so claiming working secret injection into generated apps would be false.

An internal, non-HTTP trustedEnvironment resolver prepares a minimal allowlisted server-consumer boundary: current owner and named project/environment, at most ten exact variable names, environment override before project default, authenticated decryption and access audit. It passes values only to an explicit trusted-controller callback, never spreads all entries or controller credentials into env. It clears its local map after the callback and hides consumer exceptions behind a generic error. This resolver is tested but not wired to any generated-code runner or external provider. It is an internal code boundary, not an authenticated workload identity system; future callers need separate permission/consumer review. JavaScript strings cannot be guaranteed zeroized and a trusted callback could copy them.

## Leakage defenses

Storage is separate from files/proposals/jobs/artifacts, and all API selection is metadata-only. No secret is logged or returned in validation/crypto/consumer errors. Audit stores entry ID, environment, operation, version, actor and time, not values or value hashes. It rejects UPDATE/DELETE; administrators can still alter tables/triggers, so it is not externally tamper-proof.

Before project mutation requests, exact registered values and their simple Base64 forms are checked in bounded request data. This catches arbitrary registered synthetic credentials in source proposals, prompts, terminal/build logs and preview telemetry rather than relying only on known-key patterns. MCP patch mutation has the same check. Registering a value already present in source/proposal history is refused with a generic rotate-at-provider error; the system does not pretend earlier exposure was scrubbed.

This is defense in depth, not a universal secret detector or outbound firewall. Unknown secrets, obfuscation, transformations, copied retired values, malicious controller code and already-existing external Git history cannot be guaranteed clean. A value typed into source instead of this write-only form remains untrusted source; rotate exposed credentials at their issuer. Old keys/values from before rotation/deletion are not available to the exact-match guard. Secret names are metadata: do not put a credential in the name. UI metadata is not suitable for hiding the existence of an integration from a project owner.

## Verification

npm run check: 312 tests across 14 files, typecheck, zero npm audit vulnerabilities. Fourteen Part 16 tests cover encrypted write-only storage, masks/no ciphertext reflection, environment override/minimum-name resolver, rotation/stale writes/deletion, browser/build/preview/AI injection denial, missing key, generic exceptions, owner/CSRF/project isolation, wrong key/AAD tamper, source/export/AI/build/preview separation, reserved names, concurrency, atomic rollback and exact registered-value leakage attempts.

npm run ui:build && node scripts/environment-check.mjs: 18 checks through an actual local Worker/D1/browser for create/rotate/delete, form clearing, masked metadata/no secret reflection, audit and 360/390/412/1440 layout/accessibility. All screenshots visually inspected. These are desktop viewport tests, not physical OnePlus or Safari proof. Existing 254 UI checks and populated migration/private binary+SQL backup/restore checks pass. Regressions are included in the final closeout.

Synthetic fixture keys/canaries are plainly labeled in tests. Real values never entered the repo or Git during this work. Existing .gitignore excludes .env variants and .dev.vars. No GitHub push-protection/account setting was changed, and no absolute claim about historical unknown credentials is made.

## Sources

Fetched current official/security guidance before implementation:

- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html - lifecycle, least privilege, storage/key separation and rotation.
- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html - sensitive-data exclusion and safe logging.
- https://developers.cloudflare.com/workers/configuration/secrets/ - secret bindings versus plaintext vars; deployment side effects of secret commands. No command or account mutation was executed.

Only vendor documentation and security guidance were needed for these normative implementation decisions. No claim that reading these pages configures the key, grants a consumer or proves production safety.
