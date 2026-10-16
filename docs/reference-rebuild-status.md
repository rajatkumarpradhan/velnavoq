# Reference rebuild: supported execution boundary

The reference correction is grounded in the supplied architecture/UI/agent guides and the public Apper product demonstration. The authenticated Apper interior was login-walled; this is not evidence of an exact interior match.

## Implemented and evidenced

- Owner-authored requests are stored separately from project source. Idempotent retries preserve the same request; source-revision conflicts fail closed.
- MCP private-build context exposes the latest saved request, without treating it as additional consent.
- Actual recorded project events and saved source files are inspectable from the workspace. There is no simulated build progress.
- The production preview host is configured at UI build time. The isolated preview loads approved saved source, brokers private app authentication/data, supports restart and server-confirmed Stop, and keeps guest code away from controller credentials.
- Existing private-build packages can supply frontend files and supported managed database schemas. Publication remains separate.

## Not equivalent to an autonomous general app builder

- Saving requirements does not call an external AI. A connected AI client must initiate MCP tools from its own conversation. This server has no authorized way to push a new chat turn into ChatGPT, Claude or Grok.
- `src/generation.ts` has a bounded optional Workers AI provider, but it generates review-only static source patches. `src/coding-agent-planner.ts` expressly limits it to static-web-v1, without backend generation. It is not the user's requested external-AI flow.
- `src/deployment-build.ts` performs trusted static validation; it does not install dependencies or execute arbitrary build commands. `src/build-api.ts` labels browser execution receipts as unverified. `RUNTIME_ENABLED=false` remains unchanged.
- No general npm/React/Linux framework execution adapter is implemented. No payment processing or email delivery was enabled in this correction.
- Synthetic browser/SDK acceptance proves saved-source preview and backend isolation, not real external-client generation or complete application correctness.

## Next implementable engineering work

The next independent core increment is a bounded isolated framework compiler/executor contract: pinned supported stack, reproducible dependency allowlist/cache, per-job filesystem/network/resource limits, server-attested build output, cancellation and artifact/source digest binding. It must be tested against hostile projects before enabling a broader runtime. The existing static sandbox and validation must not be relabeled as that adapter or relaxed to run arbitrary packages.

Separately, real external-client acceptance needs a working client session with the project's explicit MCP scopes. The outstanding Grok pre-authorization pattern remains with xAI support; no blind connector retries or grant changes are part of this correction.
