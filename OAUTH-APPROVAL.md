# Velnavoq OAuth and human approval

Part 15, 10 October 2026. Builds on Part 14's MCP 2026-07-28 server, consent, PKCE, scoped tokens and revocation. This is locally implemented and tested source, not a deployed OAuth service. Production identity and Cloudflare deployment remain unavailable.

## OAuth architecture

Existing issuer, authorization/token endpoints, exact pre-registered redirect, resource metadata, S256 PKCE, one-hour opaque tokens, hashed bearer storage, audience/issuer/project/client/scope checks and revocation are reused. No second OAuth server or third-party connector was added.

Added a same-server reference OAuth client to exercise the missing client-side boundary:

- Owner starts a flow with explicit scopes in MCP integrations. Registration itself grants nothing. The authorize screen still shows the exact callback/resource/scopes and requires separate approval.
- A random state is stored as a hash, bound to the initiating owner and session, with five-minute expiry. The callback checks state, issuer, duplicate parameters, current owner membership, expiry and single use before code exchange.
- The verifier is AES-GCM encrypted using a key derived from the session credential, which is not stored raw in D1. It is never returned to browser JavaScript and is cleared after consumption/cancellation. Expired pending verifiers are cleared on a later flow start; there is no scheduled database cleanup.
- The callback redeems through the existing S256 code endpoint. It checks resulting token metadata against the exact issuer, resource, client, owner, scopes and expiry. It returns status only, never the bearer or verifier. Token hashes and token IDs stay server-side; no credentials are injected into generated code, preview, tool output or browser storage.
- Cancellation and denial issue no token. A callback with a bad code or verifier becomes terminal and cannot be replayed. Existing token/client revocation still applies. The UI can cancel pending reference flows and revoke resulting grants.

The reference client is intentionally same-issuer/same-server and does not retain a usable raw bearer after the demonstration. It is not a connector to GitHub, Google or arbitrary remote MCP servers, and no external provider account/token was created. Credential recovery across a lost session is not supported. AES-GCM here protects the stored verifier, not a claim of a production managed key vault or protection against an attacker who has both the database and active session cookie.

## Exact human review

The Approval navigation target now loads actual stored proposals rather than an unavailable-service placeholder. Review returns a canonical manifest and SHA-256 reviewDigest binding:

- proposal/project identity and exact base revision;
- proposal bundle digest, exact before/after file changes and optional structured patch digest;
- full schema and requested permissions;
- risk level/reasons and the precise source-only execution boundary.

The screen shows positional before/after source, permissions, schema, risk and digests. A separate acknowledgement confirms review; deletions/renames also need explicit destructive confirmation. Source is rendered as text, never executed. Risk is conservative local classification, not a security scan. Files above the existing review line limit cannot be approved in the UI; use an inspectable smaller proposal.

POST /api/proposals/{id}/decision requires decision approve/reject/cancel, digest, reviewDigest and baseRevision. Approval also requires the displayed risk acknowledgement and any destructive/structured-patch confirmation. Existing /approve and /reject routes now require the same review envelope, so they cannot bypass it. The tests' setup helpers retrieve that envelope explicitly; the server never invents consent. Manual owner source-editor save remains a separate exact user-authored save path, not AI auto-approval.

A D1 batch executes the proposal status transition, existing source revision/normalized file/approval triggers and immutable review audit together. Trigger failure or later audit insertion failure rolls the whole transaction back. Unique proposal audit prevents concurrent double execution. Rejection/cancellation record exact decisions but never change source; cancellation is represented as terminal rejected status plus a distinct cancel audit decision.

Proposals and patch content are immutable. Changing files/schema/permissions means creating a different proposal/digest and obtaining new review. Current source revision moving makes an old pending approval stale. No old approval authorizes a later revision. Nonempty schema/permission bundles are currently refused rather than pretend-approved, because static-web-v1 has no schema migrations or downstream runtime grants.

## Audit and limits

New human_review_audit and proposal_decision_log tables refuse UPDATE and DELETE through database triggers and preserve decision history even after a project is deleted. They contain identity/digests/decision/revision/time, not source or credentials. Manual and legacy transitions also get immutable decision history; exact review routes record the full review digest. Read access remains through authorized project context. Database administrators can still alter/drop tables or triggers: this is enforced application/database immutability, not externally signed/WORM tamper evidence. Existing MCP audit is unchanged and is not relabeled tamper-proof.

Execution means atomic source snapshot only. No code execution, schema migration, deployment, money transaction or external side effect is being claimed. External side-effect compensation, persistent third-party credentials, managed encryption key rotation, external OAuth provider compatibility and public production authentication are not implemented. No cards, paid services, model keys, R2, domain or account-security changes were used. Cloudflare verification was not retried.

## Verification

npm run check: 298 tests across 13 files, typecheck and zero audit vulnerabilities. New Part 15 suite has 14 tests: exact manifest/digest, rejection, cancellation, stale revision, immutable proposal, rollback after partial database work, concurrent approval, schema/permission refusal, callback state/issuer/session/expiry/replay/duplicates, denial/cancellation/token failure, encrypted-verifier tamper, destructive acknowledgement, legacy bypass prevention and audit survival after project deletion. Part 14's 25 tests continue to cover token misuse, scope/audience/resource/issuer/expiry/revocation.

npm run ui:build && node scripts/approval-check.mjs: 19 actual local Worker/D1/browser checks: reference authorization through consent and callback, hidden token, revocation, displayed exact changes/permissions/risk, acknowledgement, atomic approved source revision, 360/390/412/1440 layouts and accessibility.

Regression checks: 29 editor, 254 UI, 39 navigation, 20 MCP, 28 terminal, 23 build and 16 repair checks. Preview checks require a UI build with VITE_PREVIEW_HOST=http://127.0.0.1:5190/; this test-only loopback host is not a production deployment. The additional preview regression did not pass in this run: the UI reported separate_preview_host_not_configured and opened no popup, so no new preview isolation result is claimed. Backup/restore verifies populated migrations, binary and SQL restoration, foreign keys and immutable triggers. Viewport/accessibility checks are desktop browser tests, not physical OnePlus or Safari performance.

## Current guidance used

Fetched official guidance before implementation; standards are used for normative protocol/security facts, not as authority to change accounts or spend:

- https://www.rfc-editor.org/rfc/rfc9700 - OAuth 2.0 Security Best Current Practice, January 2025: redirect, PKCE, CSRF/mix-up/token protections.
- https://www.rfc-editor.org/rfc/rfc9207 - authorization response issuer identifier.
- https://www.rfc-editor.org/rfc/rfc7636 - S256 proof key/code binding.
- https://www.rfc-editor.org/rfc/rfc8707 - resource indicators/audience restriction.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization - MCP authorization requirements and discovery/resource validation.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices - confused deputy, passthrough and least privilege.

No claim of complete OAuth 2.1 certification or remote SDK/provider interoperability. Local reference flow results are evidence only for this bounded implementation.
