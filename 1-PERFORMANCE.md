# Part 21: measured performance

Local performance engineering, not a production capacity claim. Measurements below use the real production React/Vite bundle, Chromium 156, workerd and local D1. No paid service, deployed cloud endpoint, live model, or physical OnePlus test was used.

## Measure first

The unchanged Part20 tree was measured before application edits. A large approved static-web-v1 project contains 50 files and 453,252 source bytes. The editor interaction test uses an unsaved 1,800-line, 23,400-byte buffer. Contract limits remain 50 files / 500,000 source bytes and editor limits 2,000 lines / 50KB. We did not remove protections to make a benchmark look better.

The mobile profile is 390 x 844, 4x CPU throttling, 150ms network latency, 200,000 bytes/s download and 90,000 bytes/s upload for the slow-network case. This is emulation, not a low-end phone measurement. API and D1 timings include local transport overhead, not Cloudflare edge latency or CPU billing.

### Before / after / repeat

Times are milliseconds. Where sampled, each cell is median / p95. "After" and "repeat" use the same candidate code in separate fresh local runs. Single startup/build results are single samples, not percentiles. Raw machine-readable results are in `performance-results.json`.

| Measurement | Part20 baseline | Part21 after | Part21 repeat |
|---|---:|---:|---:|
| Cold home load, cache cleared, n=5 | 77.41 / 199.37 | 78.75 / 209.78 | 73.72 / 200.82 |
| Slow-network, 4x CPU editor cold startup, one run | 6,420.56 | 3,889.39 | 3,905.09 |
| 4x CPU editor navigation, n=10 | 148.09 / 233.20 | 126.56 / 144.35 | 123.11 / 175.43 |
| Full context API, n=25 | 43.94 / 74.15 | 45.57 / 96.00 | 41.03 / 52.68 |
| Indexed D1 snapshot query, n=25 | 17.61 / 23.79 | 18.09 / 28.15 | 16.95 / 21.08 |
| 1,800-line editor input to two animation frames, 4x CPU, n=30 | 55.10 / 201.15 | 59.77 / 193.76 | 56.72 / 141.61 |
| Editor scrolling frame interval, 4x CPU, n=59 | 16.70 / 16.80 | 16.70 / 16.70 | 16.70 / 16.80 |
| JS heap used after editing, bytes | 11,150,632 | 11,487,408 | 11,674,908 |
| 50-file static build end-to-end, one run | 822.94 | 818.52 | 1,167.74 |
| Same build Worker reported duration | 49 | 49 | 42 |
| 50-file preview document ready, one run | 234.09 | 217.03 | 256.07 |
| 8 distinct authenticated users, 24 concurrent reads, median / p95 | 140.72 / 190.64 | 202.40 / 205.19 | 188.76 / 192.47 |
| 8 simultaneous build requests, total elapsed | 380.42 | 359.83 | 313.01 |
| Idle API requests over 2.5 seconds | 0 | 0 | 0 |

Cold load is navigation/reload until the actual home heading exists, not LCP or a Lighthouse score. Editor input timing includes Playwright dispatch and two animation frames, not field INP. Scroll timing is requestAnimationFrame sampling while scrolling the real editor, not a physical touch trace. Memory is one Chromium JS-heap snapshot, not total process RAM, an OS quota, or a leak proof. Registration setup runs sequentially; the concurrent read test then uses distinct user sessions.

The full context API/D1 code path was not optimized, so differences there are noise, not claimed improvements. Cold home load, input median, memory and build end-to-end did not show a consistent improvement. We keep these results visible. No "all faster" claim.

## Changes supported by measurement

### Remove duplicate source from the editor response

The baseline context API sends the same full source twice: `snapshot.files` and each `files[].content`, plus fields the editor never uses. At the tested project size this was 946,547 JSON bytes. The new explicit `?view=editor` projection is 475,371 bytes, 49.8% less uncompressed data. It returns exact revision, source digest and per-file content/digest/blocked state, preserves authentication and source redaction, and uses `Cache-Control: no-store`. The default agent response is unchanged. No shared authorization cache was added.

Both editor load paths use that projection. At the fixed slow-network/4x CPU profile, startup fell from 6.42s to 3.89s, then 3.91s on repeat. This is the strongest measured improvement. The script's API benchmark still measures the full default context for backward-compatible comparison, not the smaller editor view.

### Avoid repeated editor derived work

The saved source map is memoized by loaded context. Active-file byte/line counts are calculated once per content change rather than repeated in a render. The bounded 50-file tree is memoized separately, with stable open callback and primitive dirty/blocked signatures, so subsequent keystrokes in an already-dirty file do not redraw every file-tree row. Per-file CodeMirror history and the large-file safety limit remain intact.

Interaction tail improved in the repeat run, but median input latency and JS heap did not improve consistently. These changes remove redundant work; we do not report them as a proven memory or INP win. No broad memoization, project cache, tree virtualization or speculative database index was added.

### What was already bounded

The initial JS entry is 259,028 bytes raw, about 78.4KB gzip. CodeMirror/editor is lazy: about 360KB raw / 115KB gzip and absent from home-load resources. Build and runtime Workers load only for their routes. We did not add a larger client bundle or a timer-driven dashboard. There is no blur filter; existing short panel/button animation respects reduced motion. The idle route test observed no polling. D1 `EXPLAIN QUERY PLAN` uses `file_versions_snapshot (project_id, version)`, so no new speculative index was needed.

Concurrent job test: one 201, seven 409 responses for eight requests from the same user. The database one-active-job guard remains enforced. Successful concurrent reads do not prove production scalability.

## Reproduce

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run check
VITE_PREVIEW_HOST=http://127.0.0.1:5190/ npm run ui:build
node scripts/performance-check.mjs candidate
```

The script applies every migration to fresh local D1, runs the real backend adapter on localhost:8787, production UI preview on localhost:5173 and a separate preview host on 127.0.0.1:5190, then cleans up. Use only local synthetic fixtures. It is not a remote load-test tool. Use fresh processes between runs. Results are written to `performance-results/<phase>.json`; do not compare measurements from different CPU/network configurations as if controlled.

Regression checks: context projection identity/data parity, authentication, no-store and default/unknown-view compatibility; real saved near-limit source, dirty buffer, preview cleanup, concurrent user reads, concurrent job guard, no idle polling, four viewport overflow and WCAG checks. The existing editor suite additionally covers save/reload, search/replace, diagnostics, diff, review and keyboard controls.

## Unverified and next checks

- AI latency is **not verified**: no live provider binding in this harness and agent execution is gated. No mocked TTFT is presented as a real provider measurement. Once authorized/connected, capture first response token, final token, token counts, model, timeout/error and concurrency, without storing prompts/secrets in performance telemetry.
- Production cold load, navigation, edge API latency, D1 query duration/rows read, Worker Free CPU budget and production concurrency remain unverified. Local wall time does not prove the 10ms CPU budget.
- Hosted npm/framework build and container preview are not available in this free static scope. Numbers cover real static packaging and separate-origin document preview only. Browser receipts remain untrusted, not deployment proof.
- Physical OnePlus memory, mobile touch scrolling, thermals, crashes and field interaction latency need a real-device trace. Emulation is a useful regression check, not that proof.
- Before deploying, repeat on the actual free-plan endpoint with approved test limits, record p50/p95/p99 over larger samples, and stop at throttling/errors. Never use this local harness against another person's service.

Local measurements, not production performance certification.

## Verification receipt before final security integration

Part21 candidate: TypeScript, both Worker dry-run builds, 370 backend tests / 19 files, zero npm audit vulnerabilities; 29 existing editor browser checks; performance harness has 76 checks including fixture setup, 25 context reads, 24 concurrent reads and four-width layout/accessibility checks. Final security integration and its full rerun will be recorded below, not implied by these earlier numbers.

## Final integrated verification

Rebased onto the published security-remediation source, preserving its host-only cookies, session changes and security tests. Final full check: **385 backend tests / 20 files**, TypeScript, both Worker dry-run builds and **zero npm audit vulnerabilities**. Production UI build passes. Final performance harness: **78 checks** with anonymous/other-user rejection added to the editor projection tests. Existing editor suite rerun before integration: 29 checks; final integrated rerun also passed 29 checks.

Final integrated measurements (new security code, so do not attribute every change to Part21): slow-network/4x CPU editor 3,913.13ms; editor navigation median/p95 137.55/227.31ms; 1,800-line input 57.83/105.61ms; home cold 81.76/213.28ms; full context API 41.66/52.22ms; D1 query 18.62/22.68ms; JS heap used 10,983,604 bytes; static build end-to-end 817.52ms / Worker 45ms; preview ready 194.80ms; 8-user concurrent reads 235.29/236.03ms. Scroll p95 16.80ms, zero frames over 50ms. Initial JS entry is now 260,140 raw / 78,616 gzip bytes after security integration, with editor still lazy. Full raw output is retained under `finalIntegrated` in `performance-results.json`.
