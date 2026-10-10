# Workers AI typed-token regression

Verified 10 October 2026 against the real @cf/qwen/qwen2.5-coder-32b-instruct binding.

The live SSE frames use response, not choices.delta.content. Some response fragments are JSON-decoded primitives: strings, numbers and null. A string-only adapter silently dropped null tokens and numeric tokens. This removed values after previousDigest/to keys, removed digits within digest strings, and corrupted otherwise complete JSON.

Bounded content-free stream-shape capture showed:
- response types string, number and null;
- keys response, tool_calls, p and usage;
- ~130 completion tokens against requested 2048, ruling out a reached output cap in these cases;
- complete array structure reaching the planner, with missing primitive values under the old adapter.

Fix in src/ai-adapters.ts preserves string fragments unchanged and converts explicit null, finite numbers and booleans to their text representation. Missing response fields are metadata and ignored. Compound response values fail closed. All existing patch/digest/path/secret/approval checks remain in place. Diagnostic logging was removed.

Four regression tests in tests/ai.test.ts cover primitive fragments, missing-vs-null, compound rejection and digit preservation inside digest strings. Test payloads are synthetic reconstructions of observed types, not claimed raw model outputs.

Real live retest after the fix: generation created hello.html, digest-bound review approval applied it; repair proposed a fix to deliberately broken app.js, approval applied it, static JavaScript parsing succeeded and repair session reached complete. 11 live checks passed. Public registration/login remained closed with production_identity_not_configured. No paid services or new infrastructure resources.

Limits: tested one small static generation and one syntax repair, not arbitrary apps/frameworks. Static parser ran locally and posted results to the real API. Phone UI, Linux/npm runtime, app-publish/rollback and independent security certification are not established by this test.
