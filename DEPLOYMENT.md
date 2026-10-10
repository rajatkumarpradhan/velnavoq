# Deployment pipeline

Part 18 source and local integration, 10 October 2026. **Not a live public deployment.** Cloudflare access remains blocked from earlier verification and has not been retried without clearance. No cloud resources, keys, paid plan, domain or card were created. Current production config has no deployment target and returns an honest blocked job, never a fabricated release or URL.

## Implemented pipeline

An owner selects an explicit pinned approved source release, version and canonical SHA-256 digest. Exact target origin confirmation is required when configured. Current mutable project files and browser build/preview receipts are never deployment inputs.

A persisted job moves queued → building → deploying → checking → succeeded. Terminal alternatives are blocked, failed or timed_out. Immutable lineage and database state transitions prevent repointing or late success. One active job per project, a 60-second deadline, owner checks, existing Origin/CSRF/rate limits and membership checks protect writes. Reads recover interrupted expired jobs as timed_out. There is no automatic retry that could duplicate publication.

The controller's static-web-v1 validator parses JS/HTML/JSON, verifies local imports/resources, rejects external dependencies and package scripts/installs, enforces existing file/source bounds, and packages exact canonical file bytes. It does not evaluate generated code. Registered-value secret checks run before build and rollback. Generated applications receive zero secrets or controller credentials. Logs are fixed stage/error codes, not raw parser messages or source. Unknown/obfuscated secrets cannot be universally identified.

Artifacts persist exact file bytes, digest, size, source digest and job. A separate target Worker and target D1 store immutable candidate artifacts. Installation uses a service-binding RPC, not a browser-accessible POST. The target has no controller DB, auth credentials, secrets or AI bindings. Public HTTP only serves GET/HEAD under immutable `/r/<id>/<path>` with a sandbox CSP, denied fetch/connect/forms/framing, MIME and no-sniff headers. CORS permits modules on the sandbox's opaque origin without cookies. A separate hostname from the control API is mandatory. Inline script is allowed within the sandbox so ordinary static apps can run; browser execution is untrusted.

After install, the controller fetches **every exact served file** at the configured HTTP origin, rejects redirects/non-200/missing sandbox policy/digest mismatch/changed bytes, bounds response reads and uses 5-second aborts. This proves file delivery, not functional browser health, business logic, database migrations, availability under load or a sustained uptime SLA. No browser receipt can complete a job. Only then are immutable release ID, version, source/artifact digests, target ID, URL, check kind/time and current release pointer committed with audit in one D1 transaction.

Failures never promote the current pointer. Candidate URLs are unguessable but not private once installed; a failed health check can leave an orphan candidate in the target DB. No automatic candidate deletion/retention collector is implemented. Previously published immutable URLs remain accessible. Project deletion removes control-plane lineage but does not erase the separate target database; target erasure and backup retention need an explicit operator procedure. Current release is a recorded URL pointer, not a stable hostname routing switch. Release/artifact immutability is trigger-enforced, not admin-proof signed WORM storage.

## Rollback

Owner selects an exact prior health-verified release ID/artifact digest/version/source digest against the confirmed target. Rollback reuses the known-good artifact bytes, installs a new immutable target, checks HTTP delivery again and creates a new release ID. Source revisions remain unchanged. Failed rollback leaves current pointer unchanged. This is static release rollback, not database compensation, secrets revocation or automatic DNS switching.

## Deployment configuration, not applied

`DEPLOY_TARGET` is a service binding to the separate target Worker, `DEPLOY_ORIGIN` its exact origin, and `DEPLOY_MODE` is `public` (HTTPS only) or `local` (localhost HTTP only). Target schema is `deployment-target/schema.sql`, dry-run configuration `deployment-target/wrangler.jsonc`. Real account resource IDs and routes are intentionally absent. Inspect the live account for existing Worker/D1 names before provisioning; do not duplicate guessed resources. Public deployment requires cleared account access, existing free-plan capacity checks, real bindings and separate hostnames. Current Wrangler manifests keep `workers_dev:false` and placeholder database IDs.

The static controller parser CPU cost on Workers Free's limit remains unmeasured; do not turn public deployment on until representative maximum-size builds fit or move the trusted build to an approved isolated runner. The asynchronous `waitUntil` executor is not a durable Queue/Workflow: interruptions become timeout on the next relevant read. No paid external runner or arbitrary full-stack hosting was silently substituted.

## API

`/api/projects/:id/deployment` reads status, current release, latest 30 jobs, latest 100 verified releases and source pins. `GET jobs/:jobId` reads fixed stage events. `POST jobs` requires `sourceReleaseId`, `version`, `sourceDigest`, `confirmTarget`. `POST rollback` requires `releaseId`, `version`, `sourceDigest`, `artifactDigest`, `confirmTarget`. Valid unconfigured requests persist a blocked job and return 503, `deployed:false`. Configured requests return 202 queued, `deployed:false`; successful health and release evidence are read separately. Old Part17 `/versioning/deployments` remains the documented blocked legacy endpoint.

## Reproduction

`npm ci; npm run check; npm run ui:build; node scripts/deployment-check.mjs; python3 scripts/check-backup.py`. Install Playwright Chromium if absent. `npm run target:build` bundles only the separate target dry-run; no remote upload. Tests run real workerd/D1 instances and a local HTTP target, including health 503/tampered bytes/redirect, build syntax failure, exact rollback and failed rollback, audit transaction failure, immutable triggers, target GET/HEAD isolation, blocked config, deadlines, active-job exclusion, CSRF and role denial. Final verification: 335 backend tests across 16 files (14 Part18), typecheck, both Worker dry-runs, UI production build, zero npm audit vulnerabilities, 18 deployment browser checks and 20 versioning regression browser checks, plus populated migration/binary/SQL backup restore. Local integration reports `health_kind:local-http`, never `public-http`.
