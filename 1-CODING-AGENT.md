# Part 8: coding agent

The coding agent proposes source changes, not shell or deployment effects. Product inference remains disconnected. A separate temporary Workers AI test succeeded and its Worker was deleted; that test does not activate this API.

## Actual project state

Authenticated `GET /api/projects/:id/agent/context` reads current immutable D1 file versions and the last ten version digests. It includes content hashes, literal import/src/href references (not a complete dependency resolver), parsed package.json where present, and supported build-configuration files. User instructions enter the bounded planner context. Current errors, terminal output and preview feedback explicitly report unavailable because the isolated runtime and preview are not configured. There are no fabricated diagnostics.

Only the existing static-web-v1 file types are supported. There is no dependency installation or universal framework support. Secret-bearing files are excluded wholesale from model context. Recognizers block common credential formats and credential assignments, but cannot prove arbitrary text contains no secrets. No vault, environment secrets, filesystem, network, terminal or tool-execution access is supplied to the model.

## Structured changes and review

Every CREATE, MODIFY, DELETE and RENAME has path, operation, previousDigest, content, to, reason and risk. MODIFY uses a bounded full replacement of one file, not a whole-repository replacement. Existing-file changes require its exact SHA-256. CREATE requires a missing path; RENAME requires a missing destination. Paths use an ASCII allowlist, bounded length and allowed extensions. Absolute, traversal, hidden, dependency/output and credential paths are denied. Duplicate/overlapping changes, stale snapshots, known secrets, empty/no-op and whole-repository rewrites are rejected.

POST `/api/projects/:id/agent/patches` validates against current D1 source, then stores an immutable pending proposal and its structured patch atomically. It never immediately applies files. The response names `applied:false` and `requiresOwnerApproval:true`. Existing owner-only approval additionally requires the exact `patchDigest`; DELETE/RENAME require `approveDestructive:true`. Approval revalidates the patch, digest and candidate bundle before the existing atomic revision transition. Stale revisions cannot win. Rejection remains available. History retains the old files.

## Bounded planning

CodingAgent accepts a server Planner and trusted source snapshot. EnginePlanner uses the real Part 7 AIEngine with project-scoped budgets/audit, one provider attempt per step, at most 4096 output tokens and a bounded JSON response. It has no test-double fallback. Context is limited to 90KB serialized; larger projects require a future grounded retrieval strategy, not silent truncation. Model tool calls are rejected. Strict output validation supplies only an error code for at most three attempts (default two). Total deadline is capped at 60 seconds (default 30), cancellation stops the loop, and a hanging planner cannot hold the request indefinitely. No autonomous apply or repair execution occurs.

POST `/api/projects/:id/agent/run` returns 503 `agent_provider_not_connected` until a provider and model with suitable limits are configured. The tiny live Granite verification was not a coding-quality or structured-patch test. Tests use explicitly test-only planners; product routes never use them.
