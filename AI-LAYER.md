# Part 7: provider-neutral AI layer
Velnavoq by Drayvenn Lab | 9 October 2026

## Implemented and not connected
Server-only Provider/Model/Request/StreamingResponse/ToolCall/StructuredOutput/TokenUsage/AIError/RetryPolicy/Budget contracts. Engine supports capability-checked model selection, normalized async streams, bounded retries/fallbacks, request timeout/cancellation even when an adapter ignores abort, validated structured output, validated tool calls returned as data (never execution), usage settlement and minimal audit metadata. OpenAI chat-completions protocol adapter and Workers AI binding adapter are implemented and tested with explicit test-only transport/binding doubles. Test doubles are not used by the product. No provider API key exists or is put in the browser/generated applications.

`GET /api/projects/:id/ai/models` returns not-connected providers. `POST .../ai/requests` remains explicit 503 until a verified provider is wired; no fake response. Owner-only PUT/read budget and authorized events APIs work in D1. This part establishes the callable server engine, adapters and limits, not live model inference or an AI coding agent. No live credentials, paid fallback or Gateway billing.

## Decisions and semantics
Models are server-catalog entries, not arbitrary client endpoints. OpenAI endpoint is fixed; no SSRF/provider URL input. Workers candidate is @cf/meta/llama-3.3-70b-instruct-fp8-fast. Its JSON mode exists but does not support streaming JSON, so streaming structured requests are refused; tool streaming is not assumed and is disabled in that adapter. OpenAI supports configured models' tool/JSON-schema capabilities; no model is currently selected or connected there.

Retries max 3, fallback max 2 explicitly supplied connected models, total timeout max 120s, delay max 2s. Retry only rate/transient failures before any output/tool is emitted; no duplication after partial output or credential/validation failure. Each attempt gets its own budget reservation. Cancellation aborts transport/reader and races blocked iterator calls. Workers binding cancellation can stop result handling/stream reader but cannot prove remote compute was cancelled; reservation stays charged if usage is unknown. Provider errors expose normalized code/status/provider, never raw body/key or source. Stream/parser and output size are bounded. Structured output is a strict flat typed-object subset, not a full JSON Schema engine.

Prompt+tool/schema UTF-8 payload bytes conservatively bound input text-token allowance, not exact provider tokenization. It is not a dollars/neurons calculator. Per-project budget starts at zero, requires owner setting, reserves input+max output atomically, refunds only reported usage once. Missing usage retains full reservation. Overreported usage is charged beyond reserve and blocks later work. Reservations survive process failure conservatively; no unsafe auto-refund. A budget can be lowered below already charged use without enabling further inference. Token budget is cumulative until owner changes the cap, not an invented calendar billing period.

Migration 0005 stores ai_budgets/requests/events with project cascade and project/time indexes. Audit stores request IDs, project/provider/model, attempt, phase/error, token counts and time. No messages, output, tool arguments, credentials or prompt hashes are persisted. Model output remains untrusted and cannot approve a change or grant tools.

## Current primary sources and free-status check
- https://developers.cloudflare.com/workers-ai/platform/pricing/ : Workers Free 10,000 neurons/day; above needs Workers Paid. Paid-only frontier exceptions are excluded. No prepaid Gateway/Unified Billing.
- https://developers.cloudflare.com/workers-ai/configuration/bindings/ : server env.AI.run and streaming binding mechanics.
- https://developers.cloudflare.com/workers-ai/features/json-mode/ : JSON mode capability and schema errors; no streaming JSON.
- https://developers.cloudflare.com/workers-ai/features/function-calling/ : model tool requests require application validation; never authority.
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/ : model streaming/usage/request fields.
- https://platform.openai.com/docs/api-reference/chat/create : streaming deltas, incremental tool arguments, include_usage and structured output protocol.

Direct binding+own bounded engine avoids a new Gateway and provider billing. A vendor SDK would add dependencies without proving account access; transport injection allows local contract tests. Dashboard was signed out; its continuation explicitly requires policy agreement. Existing user restriction forbids accepting policies without asking, so no login/activation was performed. Docs establish free allowance, not this account's current binding/terms. Providers remain not connected. R2 remains skipped/BLOCKED by owner decision.

## Tests and remaining
105 backend tests pass: engine streaming, retry/fallback, partial-output no-retry, authentication errors, timeout/cancel including abort-ignoring adapter, strict tool/schema validation, input capability limits, OpenAI fragmented UTF-8 SSE/tool arguments/usage/error normalization, Workers test binding, disconnected rejection, pre-cancel, budget refusal, concurrent D1 reservations, idempotent usage refund, unknown/overreported usage and tenant/audit scope. Local fifth migration and updated populated backup/restore pass. 39 actual local authenticated browser checks and 262 UI checks remain green; no UI or model-generated screenshot claims.
Live model inference, full tokenization/neurons attribution, provider wiring and production identity remain unavailable. No paid keys acquired, no policy/account/security changes. Next is only the next user-directed part.
