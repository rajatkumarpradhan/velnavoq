# Part 13: bounded AI build/error/repair

Velnavoq by Drayvenn Lab. Free-only implementation.

## What exists

The AI repair screen loads failure records from the current project's persisted build, terminal and preview tables. It does not accept pasted or fabricated errors. It exposes the exact recorded output with its source ID and revision. Known secret-bearing diagnostics are refused, not sent to a model; known secret-bearing source files are excluded wholesale. This is defense in depth, not a guarantee to detect every secret.

Compiler diagnostics come from the real static build parser/compiler. Runtime errors and terminal output come from browser QuickJS. Preview exceptions and document-health timeouts come from the separate preview frame when configured. These are real local observations but all receipts are `browser-unverified`: an authenticated client or guest can forge telemetry. They are not trusted CI, deployment or security attestations. The loop does not upgrade that trust.

Server path: observed failure -> pinned evidence digest -> bounded provider request -> validated patch -> persisted immutable proposal -> existing exact patch owner approval/apply -> new build of applied revision -> complete or second reviewed repair. The existing source editor shows each change, prior digest, risk, reason and destructive-action confirmation. A repair never auto-applies or builds on behalf of the owner. The repair screen links to source review/build and checks their stored results; it cannot claim review/build occurred from a client assertion.

## Hard boundaries

- Maximum two model attempts per session, including failed calls.
- 60 seconds wall-clock session deadline; 20 seconds maximum per model request. Human review consumes that window too. If review takes longer, intervention is required; no silent background retry or extension.
- 16,000 conservative input-token budget (UTF-8 byte upper bound), 2,048 output tokens per request; 36,096 conservatively reserved total. Missing usage never refunds this session budget.
- Four distinct changed paths across the session, including rename targets. No whole-repository rewrite, unsafe paths, unknown schema fields, no-op changes or stale hashes.
- One active session per user. SQLite uniqueness, conditional reservation and terminal-state/review-gate triggers prevent concurrent calls, exceeding counters or revival of stopped sessions.
- Deadline, quota, provider failure, token/file cap and cancellation stop or require intervention. Stop/cancel/source change never exposes an applied patch. In-flight remote inference may finish after local cancellation; its result is not used.
- No retries hidden inside the provider. Every additional repair follows a fresh failed build of the approved revision. Review requires the exact persisted patch digest; success requires a new stored build of the applied source.
- Project-scoped token budget must also be set before inference. This is a token cap, not a billing calculator or a promise about remaining daily quota.

## Provider status

The source now supports Cloudflare's `AI` binding through the existing provider adapter and `@cf/qwen/qwen2.5-coder-32b-instruct`. `AI_REPAIR_ENABLED` defaults to `false`. Until a server binding and explicit enable flag are present, requests return `503 repair_ai_provider_not_connected`, with no invented diagnosis, proposal or tokens charged. A prepared binding configuration is not proof of a deployed or accessible model.

This rebuild has a placeholder D1 database ID, registration disabled and no live control-plane deployment. Do not point the configuration at a paid account or enable billing. Live binding activation and a real account model call remain pending user confirmation/account verification. A model playground test alone would not prove the product repair loop runs live.

Official sources:
- https://developers.cloudflare.com/workers-ai/models/qwen2.5-coder-32b-instruct/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/configuration/bindings/

Workers Free includes 10,000 neurons/day; requests fail when the allowance is exhausted. No paid key/card is configured. Account free-plan and quota status must be confirmed before a live call. The model context window is 32,768 tokens. No Gemini/Groq or external paid provider is enabled.

## Evidence and tests

`npm run check`: backend typecheck, Worker dry-run build, unit/integration tests and npm audit. Repair tests run a real parser/compiler failure and rebuild, but AI planner output is a clearly labeled test double, never represented as real inference. Integration tests persist the exact compiler output, reserve attempt/tokens, create a proposal, reject missing owner digest, apply approved patch and require a fresh successful build. Other receipt tests are explicitly labeled synthetic test receipts.

`npm run ui:build && node scripts/repair-check.mjs`: actual browser Worker terminal error -> persisted D1 diagnostic -> repair UI -> honest unavailable provider -> stop; checks 360/390/412/1440 layouts and accessibility. These are desktop-browser viewport checks, not physical OnePlus or Safari performance.

## Still unavailable

A real end-to-end AI repair in the deployed app has not been demonstrated. No generic model explanation or fake successful repair is substituted. Linux/npm/framework compilation, full server network/CPU isolation and reliable renderer-crash detection remain unavailable. Public preview-host deployment remains blocked and was not retried for Part 13.
