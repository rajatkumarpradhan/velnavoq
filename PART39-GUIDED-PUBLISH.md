# Part39: One-tap build, publish and database view

Source approval shows exact changed files/risk and configured public target. Approve & publish approves that exact source, pins its next immutable revision and starts the existing server-side static build/install/HTTP health pipeline, without a second confirmation. The job screen follows completion and shows the returned release link and Database button. Source-only approval remains in details. Missing shared target is a truthful blocker, not a fake URL.

This is shared free Worker hosting, not a separate Cloudflare Worker per project. The control Worker needs DEPLOY_TARGET service binding, DEPLOY_ORIGIN and DEPLOY_MODE=public installed once. Repository config has placeholders; deployment must preserve actual live bindings. No paid API, AI, domain, billing, token or account mutation in this part. This task does not deploy production.

Preview tap creates a successful same-current-revision static build if needed, then loads existing separate-host sandbox preview via nonce/MessageChannel. Overview opens its window synchronously before route navigation. Blocked popups give an explicit retry. Separate preview host configuration remains required. Existing sandbox restrictions are preserved. Browser build receipts and preview telemetry are not trusted proof of app correctness; public publishing still uses its trusted server build and exact-byte HTTP health gate.

Database shows approved table names and actual bounded rows in a read-only table. No schema invented, public data permission bypassed, or sensitive-data support added. Schema approval and activation remain exact and separate. Current public backend APIs are non-sensitive, fixed typed D1 only.

Sessions issue and slide to365days, rotating once daily with existing alias grace, bounded expiry timer retained. Existing sessions gain365days on renewal/rotation; instant upgrade of every pre-existing session is not claimed. Sign-out remains revocation. One year of complete inactivity can expire a session; it is not literally infinite login.

Validation: typecheck/build;92tests across MCP/session timer/build/preview/deployment/backend;27real two-host browser checks (automatic revision1/2 builds, actual DOM, malicious runtime error, isolation, stop/restart, four mobile/desktop layouts and axe); guided real Worker/D1 one-tap source -> trusted build/install -> HTTP verified release -> Database;365day real-browser request-count no-loop regression. Synthetic local fixtures only, no owner's app edited/published.
