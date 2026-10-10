# Component remediation policy

Proposed operational policy implemented in source workflow on 10 October 2026. Rajat's instruction to fix the reported remediation-timeline gap covers documenting this policy; production staffing/on-call execution is not verified.

Inventory: exact package.json pins plus package-lock integrity. Run npm audit and signature validation for each release. Ignore lifecycle install scripts; never install generated project dependencies. Review package provenance, license, release source and changelog before update. Source scanners cannot detect all malicious packages.

Risk-based targets from confirmed notification: exploitable critical/in-use compromise, stop release immediately and isolate/revoke exposed credentials, begin mitigation within 24 hours; high relevant exploit, block release and fix/retest within 7 days; medium within 30 days; low within 90 days. Review relevance and exceptions within 2 working days. No blanket advisory suppression. A deadline exception needs Rajat's explicit recorded risk acceptance, affected version, reason, temporary mitigation and review date. Treat unresolved provenance/integrity findings as release-blocking until triaged.

Review non-security updates monthly against maintained upstream releases and compatibility. A clean audit does not prove current-version safety. Record exact old/new version, affected source/lock hashes, advisory relevance, reviewer decision, regression evidence and remaining risk. Re-run source tests/UI/build/secret scans after updates. Keep reports private and do not silently publish real secrets. This document defines timelines; it does not claim an automated scheduled review, staffed security response or production compliance exists.
