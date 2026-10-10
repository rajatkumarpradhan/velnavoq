# Part39.1: Worker public health subrequests

Control enables Cloudflare compatibility flag global_fetch_strictly_public, allowing its global fetch to reach another Worker through the public internet, including same-account workers.dev. No health gate is weakened or replaced with an installation receipt or service-binding success. Every artifact path still requires actual configured-origin HTTP200, no redirect, exact artifact digest header, sandbox CSP and exact served bytes, bounded500KB/5s, before promotion. Failed checks keep previous known-good pointer.

Operator deployment must MERGE this flag into the live control Worker metadata while preserving existing flags, bindings, vars, live signup, secrets and AI adapter. Repository config is a local placeholder, not live account IDs. No target redeploy or migration needed. This source task does not deploy or claim the live issue resolved.

Cloudflare docs: https://developers.cloudflare.com/workers/runtime-apis/fetch/ explicitly supports Worker-to-Worker fetch via service bindings or global_fetch_strictly_public. A service binding would verify the target handler but not public DNS/routing; that was deliberately not substituted under public-http evidence.

Validation: config/source regression and existing actual HTTP deployment tests cover immutable build, exact bytes/header, wrong bytes, failure/redirect, wrong target, rollback, owner/CSRF, atomic audit and blocked configuration. Live production retest remains deployment owner's work.
