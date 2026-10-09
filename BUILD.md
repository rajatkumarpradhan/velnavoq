# Part 11: real static-web-v1 browser build

Velnavoq by Drayvenn Lab. Free-only. No new accounts, tokens or paid services.

## Supported stack and actual work

First stack is HTML/CSS/JavaScript static-web-v1. A fresh dedicated Worker materializes a read-only snapshot in memory, enforces file/size/path/secret restrictions, checks JavaScript syntax with Acorn, inline script syntax with QuickJS compile-only, HTML with parse5 and JSON with JSON.parse, checks static relative imports and referenced local assets, then generates an actual ZIP with fflate. It does not execute generated JavaScript, package scripts or commands. CSS URLs/imports are checked, but CSS syntax, dynamic runtime asset references, SVG semantics and browser application behavior are not fully validated. A valid ZIP is not proof the app behaves correctly.

No external dependency install is needed or allowed: registry allowlist is empty. package.json dependencies/devDependencies/scripts reject the build. No npm/Vite/React/arbitrary framework compilation. Source must have index.html. Local relative assets and .js imports must exist; traversal, absolute filesystem paths, bare/external module imports and nonliteral dynamic import dependencies are rejected. Public navigation links are not dependency downloads. Data URIs already embedded in source require no network. No HTTP preview/server or deployment.

## Lifecycle and identity

Authenticated source version + digest binds every build to user, workspace, project, job and unique runtime. Only owner/editor can start; viewer can inspect stored receipts/artifacts. Initiating user only can append/finish/cancel. CSRF/origin and tenant gates run before requests. D1 records build_jobs/build_events/build_artifacts. A fresh Worker per build is terminated on success/failure/cancel/navigation, so retry has no leftover guest state. Lost tabs time out on next API access after deadline; no remote process exists. One active build per user is enforced by unique DB index.

Logs and completion are browser-unverified receipts. The browser can forge its own receipt; never use this as trusted CI, release approval or deployment evidence. Success stores an exact server-side ZIP source snapshot from the pinned immutable revision, not arbitrary uploaded artifact bytes. The server does not attest that the browser checks ran. Status/identity are immutable after terminal state. Failure/cancel never generate artifact records.

Artifacts download as application/zip + attachment + nosniff through authenticated same-tenant API, not same-origin HTML execution. Use only in a separate untrusted hosting environment if later preview is enabled. Archive expires in one hour; API refuses expired downloads and deletes expired artifact data on the next build API access. No scheduled purge claim. Logs/history remain until project deletion. Archive path traversal is rejected; raw artifact ZIP size is limited to 600KB. No R2 or public artifact bucket required.

## Enforced limits and honest bounds

500KB serialized source, 50 files, 160-character paths; 600KB archive; 32KiB logs. Build wall-clock deadline 5s with checks between stages and QuickJS interrupt, separate 15s outer Worker watchdog including loading. Cancellation terminates Worker immediately from the initiating page. No background-tab timing guarantee. No vCPU/OS disk/process quota claim: source exists only in virtual in-memory files, one Worker/build, no shell/process API. QuickJS heap 16MiB/stack 256KiB; host parser/archive allocations are input-bounded, not a hard total-browser-memory limit. Guest network is absent because source is never executed. Host fetches only bundled assets and authenticated API. All package registries denied.

## Tests

229 backend/domain tests including real build ZIP bytes, intentional JS/inline/JSON syntax failure, missing/external dependencies, forbidden packages/scripts, traversal, source/artifact quotas, deadlines, retry, authenticated identity, concurrency, receipt ordering, source revision immutability, inert download, artifact expiry and cleanup. Existing QuickJS abuse tests still run.

Production-preview build browser checks use real local Worker/D1: success ZIP unzip + exact source, persisted log reload, intentional app.js syntax error visible, failure no-artifact, Worker cancellation, 360/390/412/1440 overflow/header/a11y. Browser cancellation test delays loading Worker asset to avoid racing an already-completed small build; actual Worker terminate path and D1 cancel receipt are exercised. UI tests 254 and backup binary/SQL restore pass. Physical OnePlus/Safari untested. No fake success or public deployment claim.

## Free licenses

QuickJS and wrapper MIT, from Part 10. Acorn MIT, parse5 MIT (entities BSD-2-Clause), fflate MIT. Full added notices in BUILD-LICENSES.md. Installed fflate 0.8.3 avoids the 0.8.2 unzip advisory; no production unzip of untrusted files. Tools are locally bundled, not a user-paid package service.

Sources: https://bellard.org/quickjs/ ; https://github.com/justjake/quickjs-emscripten ; https://github.com/acornjs/acorn ; https://github.com/inikulin/parse5 ; https://github.com/101arrowz/fflate
