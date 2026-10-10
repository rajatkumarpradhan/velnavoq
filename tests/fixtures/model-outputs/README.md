# Model output fixtures (planner JSON extraction)

Provenance, stated honestly:

- The production failure these fixtures reproduce is REAL: on 2026-10-10
  ~17:38-17:41 IST, six live calls to the Workers AI binding
  (@cf/qwen/qwen2.5-coder-32b-instruct) from the deployed velnavoq-control
  worker all failed with 422 agent_invalid_model_json. Recorded real metadata
  (D1 ai_events, deploy report velnavoq-live-deploy-report-58ec4c43.md):
  4581 input tokens, 784 output tokens total (individual runs 787 in/129 out,
  736 in/132 out), ~5s per call, usage reported by the provider.
- The raw reply text of those calls was never persisted: the planner streamed
  it, JSON.parse failed, and the text was discarded by design. A live capture
  re-run on 2026-10-10 evening was NOT RUN because the deploy API token
  ("Velnavoq Cloudflare API token (free-only deploy)") had been deleted by the
  user after the deploy, as instructed, and the vault entry no longer holds it.
- The .txt files here are therefore SYNTHETIC REPRODUCTIONS of the well-known
  chat-model output shapes that break a strict whole-body JSON.parse (markdown
  code fences, preamble/trailing prose, truncation). They are labelled as
  synthetic here and in the test names; they are not presented as real captures.
- The positive fixture content matches the change schema enforced by
  src/coding-agent.ts validateChanges (exact keys, CREATE with null
  previousDigest, low risk, real reason).
