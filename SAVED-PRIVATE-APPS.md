# Saved private apps

Approved connected-AI static source and its exact schema can open through the owner-only `#app` route. Opening does not reapply a package, publish a release, or broaden MCP grants. Unapproved or changed source/schema is rejected.

Saved app users, sessions, private rows, shared managed rows and rates use separate additive `saved_*` tables. Temporary preview data is not migrated. Each operation checks the owner's platform session, CSRF and pinned source/schema. Per-user row ownership and project isolation remain enforced. Explicit owner-managed account IDs, not signup email claims, control shared-content administrator roles.

Generated code stays inside an opaque iframe on the isolated host and uses the narrow MessagePort broker. It cannot read platform/app cookies, the parent page, or use arbitrary network access. The owner keeps Velnavoq open while using the app. Closing/reopening or app logout/relogin preserves saved data. An isolated window lasts up to 24 hours; reopen it to continue. App sessions last up to 30 days but never bypass platform authentication.

This is a private static HTML/CSS/JavaScript + managed typed database/auth increment, not arbitrary npm/framework/server execution or public sharing. Email delivery/recovery, external integrations and payments are unavailable. Use non-sensitive data. Limits are 100 accounts/project, 1,000 private rows/user and 20,000 rows/project/namespace.

Tests: `tests/saved-app.test.ts`, `tests/private-build.test.ts`. Rendered local acceptance: `scripts/saved-app-browser.mjs`, using the approved ChatGPT package fixture from the private evidence directory (not included in the repository). The local harness uses synthetic independent resources and does not mutate production.
