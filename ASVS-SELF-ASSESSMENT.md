# ASVS 5.0.0 requirement self-assessment

10 October 2026. Source/local evaluation only. **Not certified, not an independent penetration test, and not production-verified.** This is a follow-up to Part20's 22-area matrix, not a claim that Part20 passed ASVS. No complete ASVS level is achieved.

The official release CSV contains **345 requirements in 17 chapters**: 70 introduced at Level 1, 183 additional Level 2, 92 additional Level 3. A Level 2 evaluation must include L1 plus L2 (253 rows), not L2 rows alone. Every official row and full description is retained in [ASVS-SELF-ASSESSMENT.csv](./ASVS-SELF-ASSESSMENT.csv), with status, evidence/missing-evidence rationale and scope. No rows are silently dropped. Level 3 rows are inventory only, not evaluated.

| Introduced level | Pass (local scope only) | Fail | Not applicable | Not verified | Total |
| --- | --- | --- | --- | --- | --- |
| L1 | 32 | 12 | 10 | 16 | 70 |
| Additional L2 | 32 | 17 | 49 | 85 | 183 |
| Additional L3 | 0 | 0 | 0 | 92 | 92 |
| L1+L2 cumulative | 64 | 29 | 59 | 101 | 253 |

Pass means the exact stated source/local boundary has evidence, not a broad production pass or formal proof. Fail means a required control is demonstrably absent/inconsistent in the current implementation. Not applicable requires a recorded feature/surface absence reason and must be revisited if scope changes. Not verified means insufficient whole-requirement evidence, including incomplete coverage, untested policy, cloud configuration or operator procedure. An implemented partial mitigation is not a pass. No percentage score is used.

All 70 L1 and 183 additional L2 rows have a status/rationale. This does **not** mean every row's verification is complete: the 101 cumulative not-verified rows explicitly identify that it is not. The 29 cumulative failures block a Level 2 claim even before unresolved rows. Applicable scope and exclusions need independent review.

## Additional failed controls found during exact mapping

- V3.3.1/V3.3.3: current Secure cookies lack required __Secure-/__Host- prefix.
- V3.4.1: no verified one-year HSTS policy.
- V6.2.2/V6.2.3/V6.2.4: no password change/current-password check/common-password screening.
- V6.3.3 and related L2 requirements: MFA/recovery missing.
- V7.2.4: login creates a new session but does not revoke the prior current session on reauthentication.
- V7.3.1 and other L2 lifecycle controls: no idle timeout/concurrent-session policy/step-up-based session management.
- V10.4.2: consumed authorization codes are rejected, but reuse does not revoke already-issued tokens.
- V15.1.1/V15.2.1: risk-based dependency remediation timelines not established.
- V16.2.1/V16.4.3: generic logs lack actor identity on every event; no separate forensic analysis/alert sink.
- Literal sanitization controls for generated executable app content are not satisfied merely by sandboxing; compensating boundary is documented, not counted as literal compliance.

This reporting task does not silently alter auth/OAuth behavior. The open failed controls need a separate scoped remediation pass, integration/browser regression tests and cloud/operator verification where appropriate. Do not fabricate a certificate while these remain open.

## Evidence and provenance

Reviewed source is the Part20 published tree; current private repository source readback matches the assessment base. Tests: 367/18 files, both Worker dry-runs/TypeScript and dated npm audit 0. Supplemental registry signature and Gitleaks results are documented in [SECURITY-VERIFICATION.md](./SECURITY-VERIFICATION.md). Requirement tests/source references are in each CSV row; they support only the stated local scope. No Git history or production external-scanner scan was performed.

Official requirement inventory used: https://github.com/OWASP/ASVS/releases/download/v5.0.0_release/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv

Release: https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release

Certification policy: https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x04-Assessment_and_Certification.md

ASVS requirement descriptions are reproduced from OWASP ASVS 5.0.0, © OWASP Foundation and contributors, licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . The reproduced/adapted requirement inventory and assessment annotations are made available under the same license; this does not change the private repository audience or license unrelated Velnavoq code. Changes: added local status/evidence/scope fields and inventory counts; OWASP does not endorse these judgments. Assessment is assistant-authored for Rajat, not an independent auditor's signed opinion.
