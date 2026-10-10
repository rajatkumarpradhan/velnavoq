# Security verification process

10 October 2026. Free local checks now, public checks only after an authorized live deployment, and independent assessment later. This is a runbook, not a certificate. OWASP does not endorse or issue ASVS certifications. Scanners do not replace requirement-by-requirement verification.

## 1. Current local evidence

The source assessment is [SECURITY.md](./SECURITY.md). Public password login and deployment remain blocked. No scanner was pointed at a public or third-party target. All evidence below is from the Part20 tree; no production assurance is inferred.

| Check | Actual result on 10 October 2026 | Meaning / limit |
| --- | --- | --- |
| `npm ci` | Passed with repository lifecycle scripts disabled | Reproducible locked install; does not prove package code safe |
| `npm run check` | 367 tests, 18 files, TypeScript, both Worker dry-runs passed; 0 npm audit vulnerabilities | Actual local workerd/D1 tests, including 18 Part20 tests; not a live pentest |
| `npm audit --json` | 0 total reported vulnerabilities | Registry advisories only, dated result |
| `npm audit signatures` | 128 packages verified registry signatures; 60 verified attestations; exit 0 | Registry provenance check, not malware or code-behavior verification |
| Gitleaks 8.30.1 `dir --redact` | Exit 1, 3 generic-api-key findings in test files | All 3 inspected in original source: same synthetic rejection-test fixture, no real service key. Unsuppressed result preserved. No Git history scan performed |
| Browser regressions | Observability 21, deployment 18, versioning 20 passed | Local app/API with four-width checks; browser receipts remain unverified |
| Matrix view | 8 accessibility/no-overflow checks; 360/390px inspected | Document presentation only, not product security telemetry |
| Backup restore | Populated migrations, binary/SQL restore, integrity/FKs and deletion graph passed | Local recovery correctness, not cloud retention/erasure |

Gitleaks binary was downloaded from its official v8.30.1 GitHub release and checked against the same release's published SHA-256 checksum. This checks downloaded-byte consistency, not independent signer trust. The scan used a clean source-only copy, including tests and repository configuration but excluding node_modules/build outputs. It did not scan remote Git history, deployed assets, external storage or runtime secrets.

The three findings are `tests/build.test.ts:15`, `tests/integration.test.ts:124`, and `tests/integration.test.ts:145` in this snapshot. Each deliberately feeds a fake API-key-shaped string to secret-rejection tests. Do not globally suppress generic-api-key or exclude all tests. Re-review new findings individually; real keys need provider revocation/rotation even if removed from source.

## 2. Repeat local checks before every release

Use the exact reviewed commit in a clean checkout. Node version is `.node-version`; npm settings are `.npmrc`. Never paste runtime credentials into test reports. Save raw evidence privately, not in a public repository.

```sh
npm ci
npm run check
npm run ui:build
npm audit --json > npm-audit.json
npm audit signatures > npm-signatures.txt 2>&1
node scripts/observability-check.mjs
node scripts/deployment-check.mjs
node scripts/versioning-check.mjs
node scripts/security-check.mjs
python3 scripts/check-backup.py
```

Install Chromium for browser checks with `npx playwright install chromium`. Review and pin any downloaded scanner release; don't run install commands copied from untrusted source files. Obtain Gitleaks from its official release page, verify its published checksum, then inspect help for your pinned version.

```sh
gitleaks dir . --redact --report-format json --report-path ../gitleaks-working-tree.json
gitleaks git . --redact --report-format json --report-path ../gitleaks-history.json
```

The `git` command requires a real checkout with the intended history. A source ZIP cannot establish historical cleanliness. Scan build artifacts separately and inspect any source maps/embedded values. Keep reports private; redaction is defense-in-depth, not permission to publish. Triage every finding as confirmed secret, synthetic fixture, false positive or unresolved with file/rule/evidence/owner. An unresolved finding stops release. A baseline is not proof a historical secret was harmless; remove narrow exceptions after review and rotate real credentials.

## 3. Gate before public testing

First clear the Cloudflare account block through an authorized route. Do not retry blocked account access automatically. Inspect existing Worker/D1 resources and free-plan capacity, then configure separate controller/preview/target hostnames and real bindings. Do not enable public password login until an approved production identity solution, MFA/recovery/session policy and CPU/load evidence exist. No paid plan or security-firm purchase is authorized by this runbook.

Record exact source commit, domains, scope, owner permission, staging accounts for owner/editor/viewer in two tenants, test window, backup/restore point, contact and stop conditions. Prefer staging with synthetic data. Use a low-impact passive scan first. Even a spider sends requests and can follow GET endpoints with side effects; review such endpoints and exclude logout/destructive routes. Stop on overload, throttling, challenges or unexpected writes. No scans of other people's sites or broad infrastructure are permitted by this document.

## 4. Free live checks after that gate

### ZAP baseline

Use the official ZAP Docker image and pin the reviewed image digest for reproducibility. Docker/ZAP is not installed in the current local environment, so this step has **not** been run. The official baseline spiders for about one minute and passively analyzes responses; it does not run active attack rules by default. It still generates traffic. Run only against the exact owner-approved staging URL, not a guessed hostname.

```sh
mkdir -p zap-output
# Replace the sample host with the exact approved staging origin.
docker run --rm -v "$PWD/zap-output:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://APPROVED-STAGING-HOST/ -m 1 -T 5 \
  -r baseline.html -J baseline.json
```

`stable` changes over time; replace it with an inspected immutable digest before a repeatable assessment. Official exit codes: 0 success, 1 at least one FAIL, 2 WARN without FAIL, 3 other failure. Default alerts are WARN, so exit 2 is not a clean pass. Review every alert, capture evidence and assign fixes/retests. Do not ignore all warnings to turn the job green. A configured failure policy should match the threat model and individual reviewed rules.

For authenticated coverage, use ZAP's documented context/authentication configuration, dedicated staging users and session handling. Baseline alone may only see login pages. Test all roles and two tenants separately. Do not export cookies or tokens into shared artifacts. Active scanning, fuzzing and credential attacks need a separate exact scope/window/backup approval; they are not implicitly allowed by the baseline step.

### Mozilla HTTP Observatory

Open the official MDN Observatory page and enter the exact public hostname only after it exists and its owner agrees. Inspect HTTPS redirect, CSP, cookie settings and security headers. Save URL/date and actual recommendations. Not run yet: no live public hostname. A good score measures selected HTTP configuration, not tenant isolation, secret safety or sandbox security. Consider public disclosure of the hostname/results before using an external scanner; never submit private source, headers, credentials or private intranet URLs.

### Qualys SSL Labs

Open the official SSL Server Test and enter the exact approved public hostname. Assess certificate validity/chain, protocol/cipher configuration and TLS exposure. If available, select its option not to show results on boards; do not assume scan results are confidential. Not run yet: no live public TLS endpoint. Domain-validation HTTPS proves encrypted connection/domain control, not secure application code. Avoid repeated scans; allow completion before retrying.

### Application-specific manual verification

Repeat the matrix with real production-like configuration: missing/expired/revoked sessions, CSRF and exact Origin, owner/editor/viewer operations, two-tenant foreign IDs, exact approval lineage, OAuth PKCE/state/code replay/issuer/audience, MCP scopes/revocation, log isolation, request body quotas and server deadlines. Add idle/step-up/recovery/MFA, trusted-proxy IP behavior, per-user/global quotas and low-risk load evidence. Confirm no credentials enter source, screenshots, browser apps or logs. Inspect real DNS/egress controls and storage/backup permissions. Passing generic scanners cannot prove these business-logic controls.

## 5. Findings, fixes and release decision

For every finding keep: ID, attack, impact/severity rationale, component/commit, reproducible steps and redacted evidence, ASVS5 requirement, owner, mitigation, regression test, retest date/result and residual risk. Use statuses open, fixed awaiting retest, verified fixed, accepted risk or not applicable with rationale. Never relabel an unavailable test as passed. False positives need written evidence. Do not deploy with unresolved critical/high findings; any accepted risk needs the owner's explicit decision. Retest changes against all affected paths, including roles and tenants.

Preserve evidence in access-controlled storage with a retention/deletion plan. Record scanner version/configuration, source commit and test accounts/roles without secrets. Runbook completion is a checklist of observed results, not a fabricated certificate or score.

## 6. Independent assessment later, paid only after Rajat chooses

Prepare a private evidence pack: architecture/trust boundaries, exact source commit, ASVS 5.0.0 inventory, scoped environments/API/MCP/preview/target, role/tenant test accounts, data classification, auth/session flow, logging/retention, rate limits, dependency inventory and existing findings. Choose intended ASVS level and requirements with the assessor. A hybrid source/configuration-led assessment plus authenticated pentest is more useful than an unauthenticated scanner report.

Ask firms for their methods, assessor qualifications, confidentiality/data handling, exact scope/limits, requirement-by-requirement passed/failed/not-tested/not-applicable report, reproducible redacted evidence, severity rationale, remediation advice, retest allowance and total quote. Compare quotes, but book/pay/share private material only after Rajat approves the firm, scope, recipients, budget and terms. No firm has been contacted or commissioned.

Deliverables should name the assessed commit/environment/date, coverage and excluded/unverified requirements. An attestation may be the firm's own statement, never an official OWASP endorsement. Reports expire in relevance as source/configuration change; retain a repeatable retest process. Automated tools and this assistant-authored assessment are not an independent pentest.

## Sources

- OWASP assessment/certification: https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x04-Assessment_and_Certification.md
- ASVS5 release: https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release
- ZAP baseline usage/exit codes: https://www.zaproxy.org/docs/docker/baseline-scan/
- MDN HTTP Observatory: https://developer.mozilla.org/en-US/observatory
- Qualys SSL Labs: https://www.ssllabs.com/ssltest/
- Gitleaks commands/releases: https://github.com/gitleaks/gitleaks
- Scanner release used locally: https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1

## Requirement-level gate added after Part20

See [ASVS-SELF-ASSESSMENT.md](./ASVS-SELF-ASSESSMENT.md) and its editable CSV. Exact official inventory is 345 rows, including 70 L1 and 183 additional L2. Source/local self-assessment has 12 L1 failures/16 L1 not-verified and 17 additional L2 failures/85 additional L2 not-verified. No full level passes. Implement and retest failed controls, then gather the missing deployment/operator evidence before any assurance claim. A source-level pass in a row is not a production attestation.
