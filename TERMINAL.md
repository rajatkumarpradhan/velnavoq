# Part 10: free project terminal

Velnavoq by Drayvenn Lab. Implemented free browser execution, not a hosted Linux shell.

## Actual commands

- `ls`: list the persisted project snapshot.
- `pwd`: virtual root `/project`.
- `cat PATH`: read an allowed snapshot file.
- `js PATH`: execute JavaScript in QuickJS WebAssembly inside a dedicated browser Worker. Relative `.js` imports resolve against this snapshot only. `console.log/error/warn` stream real output to the page.

No Bash, Node.js, npm, binaries, package install, DOM, HTTP server or live preview. Unsupported OS commands are rejected, not simulated. JavaScript gets no fetch, sockets, process, environment, cookies, storage, Worker, or host filesystem. The two bounded console callbacks are the only guest-to-host API. Virtual source is read-only; source changes still use editor versioning and review.

## Limits actually enforced

| Resource | Free mode |
| --- | --- |
| CPU | No vCPU quota claim. QuickJS interrupt deadline: 3s default, API 100-5,000ms. A separate browser watchdog terminates the Worker after timeout + 10s for startup. |
| Guest memory | QuickJS allocation cap 16MiB; stack cap 256KiB. These are not a cap on total browser/WASM engine memory. |
| Virtual disk | 500,000 bytes serialized source; 50 files; no host or writable disk. |
| Processes | One dedicated Worker/job; unique active-job index per user; no guest subprocess API. |
| Output | 32KiB, page event cap 1,000; up to 50 events per receipt request. |
| Network | Guest deny-all. Host loads same-origin WASM and uses authenticated API. No network callback supplied. |
| Registries | Empty allowlist. Package installs disabled. |
| Async jobs | 1,000 pending microtasks; unresolved top-level module promises fail. No timers supplied. |

Wall deadline is checked cooperatively by QuickJS; browser process/OS CPU scheduling is outside this app. Closing/navigating the page terminates local execution. No background execution guarantee. Browser crash, offline tab, or lost cancellation receipt is closed on the next authorized API read after the server deadline (execution timeout + 20s). This metadata timeout is not proof of remote process termination; there is no remote process.

## Identity and persistence

Authenticated API binds every command to `user_id`, `workspace_id`, `project_id`, `id` (job), `runtime_id`, source revision and source digest. CSRF/origin and tenant access gates run before job creation. Owner/editor execute; viewers read receipts only. Only initiating user may append/finish/cancel. Runtime ID must match. Stale source and shell syntax are rejected before job creation. Secret-pattern source files are excluded using the existing source-context filter (defense in depth, not complete secret detection).

`terminal_jobs` and ordered `terminal_events` are D1 records. Result transitions are terminal/immutable and never update source, releases or deployments. All browser receipts carry `browser-unverified`. A client can forge its own console/result receipt; these must never authorize approvals, trusted build claims, deployments or security decisions. Server checks identity, shape, quotas and state, not whether JavaScript actually ran. Stream is live Worker-to-page; bounded output receipts persist after stop, not an SSE server runner. Server cancellation alone does not reach another tab; the initiating page terminates its own Worker.

Runtime IDs and job bindings are isolation identifiers, not secrets or attestation tokens. Output containing recognizable secret patterns is refused by receipt storage; the local page may already have displayed it.

## Free choice and licensing

QuickJS and QuickJS Emscripten wrapper: MIT, permits commercial use. Notices in TERMINAL-LICENSES.md. One release-sync WASM artifact only, locally bundled, no CDN runtime dependency. Production build: runtime Worker about 54.8KB raw; WASM 503.13KB raw / 235.94KB gzip. Terminal UI about 5.2KB raw / 2.2KB gzip. Runtime loads only when running a terminal command. No new account, API key, paid plan or license activation.

Alternatives checked October 9, 2026:

- Cloudflare Sandboxes/Containers: available on Workers Paid, not free Linux execution. https://developers.cloudflare.com/sandbox/ and https://developers.cloudflare.com/containers/pricing/
- WebContainers: commercial production API requires a license. https://webcontainers.io/enterprise
- Render Free: free instances are explicitly not for production; account setup and per-project isolation/egress enforcement remain extra work, not a free drop-in security boundary. https://render.com/docs/free
- Pyodide: Python/WASM, not subprocess/Linux compatibility; doesn't fit current JS/static source as closely. https://pyodide.org/en/stable/usage/wasm-constraints.html
- QuickJS: chosen for bounded JavaScript isolation, not a substitute for Linux compatibility. https://bellard.org/quickjs/ and https://github.com/justjake/quickjs-emscripten
- Browser Worker termination semantics: https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate

## Verification

`npm run check`: 192 tests, including actual QuickJS memory/stack exhaustion, CPU loop timeout, output flood, prototype/constructor attempt, globals, filesystem traversal, import restrictions, microtask flood, source quotas, D1 tenant/role/runtime identity/receipt order/terminal transitions. No generated commands run in the control-plane Worker or developer OS shell.

`node scripts/terminal-check.mjs`: 28 production-preview browser/real Worker-D1 checks: actual JS output, stderr, file tree, saved receipt reload, shell rejection, cancellation, timeout, source binding, 360/390/412/1440 overflow/header/a11y. `npm run navigation:test`: 39. `npm run ui:test`: 254. Build and backup binary/SQL restore pass. Physical OnePlus/Safari untested. No claim of formal sandbox security proof or live hosted runtime.

Existing `/api/projects/:id/runtime` still returns 503 for hosted runtime. Browser terminal API is `/api/projects/:id/terminal`. Public deployment, DB creation and account activation remain outside this source implementation.
