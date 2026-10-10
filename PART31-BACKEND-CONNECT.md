# Part 31: reviewed fixed data API, connector setup and recovery

## What is real

A fixed backend API on the isolated release Worker/D1, not generated server execution. MCP can propose a bounded typed schema and public read/create permissions. The owner sees exact fields, permissions and digest on Backend schema, and approves that schema once. Additive migrations only: dropping tables/fields or changing types is refused. Up to 8 tables, 12 required fields/table, string/finite-number/boolean values, 1000 characters/string, 4096-byte request, 5000 rows/table and 100 rows/read. Prepared statements always bind project and table values. A shared generic rows table uses explicit project_id and table_name isolation instead of dynamic SQL table prefixes.

Public GET/POST allow only reviewed read/create permissions. Public callers have no update/delete, app login, roles or private row access. Controller owners can list/update/delete through authenticated backend/data endpoints and the service binding, not a public admin route. Public requests carrying cookies or Authorization are rejected; no controller session is accepted on the target. Read/create disabled by default unless the exact schema says public. Rate cap is30 requests/minute per project+hashed IP; rows are capped atomically. Public forms are spam-prone despite this cap, so this is for synthetic/non-sensitive project data, not real patient/payment/identity data. The schema deny list and secret scan are defense-in-depth, not complete sensitive-data detection.

After a healthy static release, Activate approved backend atomically installs the approved target config and stable routing at /a/project-id/. No redirect to mutable controller source. Frontend may call relative api/table with credentials:'omit'. Stable page CSP permits same-origin network, scripts stay sandboxed without same-origin privilege; CORS is public and credential-free. Stored strings are data, never injected into HTML by this runtime. Client code must render text safely. Immutable /r/ URLs stay static and retain connect-src none. Controller activation tracking and target activation are separate databases, not one global transaction. A target success followed by controller audit failure may leave the target active, so failed activation receipts require reconciliation, not blind retry claims.

Project Autopilot remains off by default. Owner may additionally pin the digest of an already-reviewed backend while granting public-release permission. After a healthy own static release, MCP publishing can activate only that pinned approved backend. Future schema changes need another exact owner review and a new pin. Turning off is checked before target activation, but cannot cancel an RPC already executing or withdraw public data/source already served. No automatic arbitrary schema expansion. Frontend source apply/check/repair/publish remains the existing scoped loop; this Part does not add a built-in autonomous backend diagnosis/model loop.

## Connect

Connect your AI card shows the exact project MCP URL. Copy URL and open Grok Connect opens grok.com/connectors; choose New Connector > Custom, paste URL, then authenticate. Project-bound dynamic public-client registration now advertises its endpoint through protected-resource discovery. Registration creates a pending client only, no token or Autopilot grant. The signing-in project owner must approve the exact callback/resource/scopes; S256 PKCE, code expiry, one-use exchange and revocation remain. Project issuer is returned consistently. Single callback, registration rates and pending counts are bounded. No remote callback fetch or secret from the client.

Other MCP clients use the same URL and OAuth. The card links ChatGPT and Claude, without claiming installation. No verified prefilled Grok connector-install link exists in inspected docs. Literal one-click/no-copy installation, real Grok connection and all-client compatibility remain unverified. There is no unified schema+files approval card yet: schema approval plus explicit Autopilot is the current shape. Schema scope is separate from source scopes; no MCP stored-data export/write tool is exposed.

## Free-model latency and stale clients

Staged file calls now have90s wait,640 output-token cap, prompt target1200 chars and hard1500-char returned file limit. Plan remains20s/160 tokens. Session lock100s. Provider SSE is consumed incrementally. First-token delay, final output bytes and call duration are saved and shown with budget. This does not stream generated code to the browser or promise model success. Preserved ai-adapters.ts and same free Qwen32B model; no unmeasured model fallback. Cloudflare HTTP wall duration is unlimited while client stays connected; network wait is not CPU. Free CPU10ms and AI daily limits still apply. Production success remains to be tested after deploy.

Vite lazy-chunk failures automatically reload once per five-minute window, then show New version / Reload latest version rather than blank screen. React error boundary supplies visible fallback. Root and index no-cache; hashed assets immutable.

## Deployment and verification

Do not deploy this builder's work without the separate deploy workflow. Apply control migrations0024 and0025 intact, and deployment-target/backend-schema.sql to target D1 before updated target/control/UI. Preserve production bindings/secrets, REGISTRATION_ENABLED=true and ai-adapters.ts. No new resources or paid plans. Static source Bundle remains unchanged; backend configuration is separately reviewed.

Tests include schema/path/type/secret/sensitive rejection, public data tenant isolation, no cookie/auth escalation, denied permissions, immutable exact schema approval, real target D1 activation+public create/read+owner update/delete, dynamic registration through full consent/PKCE/token/tools chain and project issuer, stale chunks, generation budget/retry regression and prior static deployment behavior. Mobile visuals are local fixtures, not external-client/live model proof.

Sources inspected:
- https://docs.x.ai/grok/connectors
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers-ai/platform/limits/
- https://developers.cloudflare.com/workers-ai/models/qwen2.5-coder-32b-instruct/
