# ASVS security remediation follow-up

10 October 2026. Owner approved fixing reported ASVS gaps. This changes locally verified source only, not public deployment or certification.

Implemented: host-prefixed Secure/Path=/ session and CSRF cookies, with no acceptance fallback to legacy names; HTTPS control and static-target one-year HSTS/includeSubDomains headers; 3000 pinned, policy-length-compatible common-password entries screened on registration/new password selection; current/new-password authenticated CSRF endpoint; transactional salted hash change plus all-session termination; same-user supplied current-session termination on successful login reauthentication; consumed OAuth code replay revokes tokens linked to that exact code only after exact client/redirect/resource/verifier validation; issuance/lineage/consumption atomic batch with trigger race gate; component remediation timelines and risk-acceptance policy. Public hashing remains disabled.

Existing unprefixed sessions require signing in again. Password change API: POST /api/auth/password with exactly currentPassword and newPassword, current session and CSRF. Success terminates every session and requires sign-in; no plaintext passwords logged or externally sent. Existing login does not block legacy common passwords automatically; users can migrate by password change. Only matching current same-user credential is terminated on reauth, not a different user's session. No periodic password expiration added.

The blocklist is an offline pinned SecLists subset with license/provenance in PASSWORD-BLOCKLIST.md. It is not a comprehensive breached-password feed. HSTS is emitted only for HTTPS; local HTTP is not TLS assurance and production UI/edge delivery remain unverified. includesSubDomains applies below the exact responding host; actual parent-domain policy remains a deployment decision. OAuth lineage covers newly issued tokens after migration; previously consumed codes cannot be retroactively mapped safely. Do not claim historical token revocation coverage.

Open: MFA/recovery, idle/step-up/admin session controls, production identity/TLS/edge quotas, full DNS/egress firewall, unknown package threats, sandbox escapes, separate log sink, data erasure and previously not-verified requirements. Requirement counts may change only where exact local controls and passing tests support the row. No independent attestation.

## Current results

382 backend tests across 19 files (15 added follow-up tests), TypeScript/both Worker dry-runs pass, npm audit zero vulnerabilities. UI build passes, real account-password-change browser flow adds 18 checks across 360/390/412/1440px; 21 observability/18 deployment regressions and populated backup/restore pass. Auth form pixels at 360/390px inspected.

Updated ASVS L1: 39 local passes, 3 fails, 10 N/A, 18 not verified. Additional L2: 33 local passes, 16 fails, 49 N/A, 85 not verified. Cumulative L1+L2: 72 local passes, 19 fails, 59 N/A, 103 not verified. L3 remains 92 not verified. No full level achieved.
