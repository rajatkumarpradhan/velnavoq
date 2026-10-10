# Current: Part 30

See PART30-MCP-AUTOPILOT.md for the current source/static Autopilot tools, scopes, limits and protocol compatibility. The Part 14 architecture below is historical: review-only defaults remain, but explicit owner Autopilot can permit source apply and project static release. External-client installation is not yet verified.

# Velnavoq MCP architecture

Part 14, researched and tested 10 October 2026. Protocol baseline: **2026-07-28**. This is a limited modern MCP server and owner permission UI, not a remote-server connector or a claim of universal client compatibility. Source and tests are implemented; the control plane is not deployed. Existing password sign-in is explicitly local-only; production owner identity still needs configuration before this OAuth flow can be enabled publicly.

## Current specification decision

The current official revision replaces the legacy initialize/initialized session exchange with per-request metadata. This implementation uses stateless Streamable HTTP POST with JSON responses, required protocol/capability metadata and mirrored protocol/method/tool-name headers. It implements server/discover, ping, tools/list and tools/call. Results include resultType complete and server identity metadata. Missing metadata, header mismatch, unsupported versions, unknown methods, invalid arguments and tool failures have separate error paths.

There is no SSE response streaming, subscriptions, MRTR, resources, prompts, legacy session negotiation or resumability. No SDK interoperability certification is claimed. Tools are implemented directly against the current wire specification; older initialize-based clients will fail, deliberately.

## Public versus protected

| Tool | Grant | Effect |
| --- | --- | --- |
| velnavoq.capabilities | none | Static feature limits only, no project data |
| velnavoq.project | project.read | Named project identity, revision and source snapshot digest |
| velnavoq.files | files.read | One exact current source file, bounded size and known-secret exclusion |
| velnavoq.propose_patch | patch.propose | Immutable review proposal, maximum four changes; never applies |

Public discovery lists only the public tool. Bearer discovery lists only tools covered by the token's exact scopes. Tool names, schemas, annotations and client identity are metadata, not authority. There is no shell, payment, deploy, auto-apply, permission-change or remote-tool execution capability. A patch client can request project.read to obtain the sourceDigest and files.read to obtain per-file digests; patch.propose alone does not imply those read grants.

Endpoint: POST /mcp/projects/{projectId}. Send Content-Type application/json, Accept application/json, text/event-stream, MCP-Protocol-Version 2026-07-28 and Mcp-Method. tools/call also requires Mcp-Name matching params.name. Each params._meta includes io.modelcontextprotocol/protocolVersion and io.modelcontextprotocol/clientCapabilities. Client info is optional, self-reported and never used for authorization.

## Explicit authorization

Owner-only management is at the project's MCP integrations screen. Registering a client grants nothing. Only pre-registered public clients are supported, with one immutable exact HTTPS redirect or HTTP loopback callback. Arbitrary redirects, fragments and embedded credentials are refused.

1. Client starts /oauth/authorize with response_type code, client_id, exact redirect_uri, exact resource, explicit scopes, state, S256 code_challenge and code_challenge_method.
2. The signed-in owner sees the named client, callback, project resource and exact scopes. Approve or deny uses the existing session, Origin and CSRF checks. The pending request expires after five minutes.
3. Approval returns a single-use code, state and issuer to the exact callback. The code expires after one minute. Client redeems it at /oauth/token using its verifier, client, callback and resource.
4. Access token is an opaque bearer valid for one hour. Only its hash is stored. Every request checks expiry, revocation, issuer, audience, project, client and current owner membership, then the exact tool scope.
5. Owner can revoke one token or the entire client. /oauth/revoke also supports token/client-bound revocation. Revoked grants cannot be revived by clearing revoked_at. Membership loss denies current access.

Discovery: /.well-known/oauth-authorization-server and /.well-known/oauth-protected-resource/mcp/projects/{projectId}. Protected failures return a WWW-Authenticate metadata challenge; insufficient scopes return 403. Raw bearer credentials never appear in the UI, logs or audit table. No refresh tokens, dynamic client registration, client metadata URL fetching, token passthrough, third-party authorization or external MCP connections exist. Cross-origin browser-client CORS support is not implemented; use a client-side backend or the same-origin flow, not a browser-only cross-origin OAuth client.

## Untrusted input and boundaries

Source, repository text, generated code, uploaded content, AI output and tool results remain untrusted data. Results carry an explicit trust marker. The server does not execute their instructions, render returned source as HTML, grant permissions from annotations, fetch output URLs or auto-apply proposed patches. Known-secret matching is a protective heuristic, not proof that arbitrary text is secret-free: files.read is a disclosure grant for the named project's source.

Patch validation reuses the exact-source digest/revision and immutable proposal path. A second conditional database check gates mutation on current token/client/membership/revision. Output size is checked before proposal writes. Owner review and separate approval remain mandatory.

Limits: 60 public MCP requests/minute/IP, 30 authenticated MCP requests/minute/token/IP, 20 authorization/token/revocation/management requests/minute/IP, plus existing session write limits. Requests are bounded, returned source is at most 100 KB and result payload at most 150 KB before wire duplication. Audit records store method, tool, outcome, identity/token IDs when validated, time and request hash, not raw source or credentials. Anonymous/invalid-token events have no project association and are not exposed in project audit UI. This is local D1 audit history, not an externally exported tamper-proof log. Retention/pruning is not implemented; production capacity and quotas need review before deployment.

## Verification

npm run check: 284 backend tests across 12 files, typecheck and zero npm audit vulnerabilities. Part 14 includes 25 tests covering unauthorized access, exact consent, S256 client/resource/redirect/verifier binding, code replay/concurrency, schema argument types, scope/project isolation, expiry/issuer/audience, membership loss, session-versus-bearer separation, revocation/no-revival, traversal/secrets, immutable proposal-not-apply, bounded mutation, version negotiation, audit and rates.

npm run ui:build && node scripts/mcp-check.mjs: 20 checks using a real local Worker/D1 and browser, registration without grant, explicit owner review, callback state/issuer, token redemption, protected project RPC and UI revocation to 401; 360/390/412/1440 layout/accessibility checks. This proves the local flow, not deployed endpoint reachability, physical phone/Safari performance or independent-client compatibility.

Existing regression checks: 254 UI checks and 39 navigation checks. Local populated migration and backup/restore checks cover schema integrity. No paid services, cards, model keys, R2, domains or account-security changes were used.

Cloudflare deployment remains blocked from the prior single verification-wall attempt. Part 14 did not retry it, create resources, enable AI or make a model call. Do not advertise a working public MCP endpoint yet.

## Sources

Official current specification and release, fetched before implementation:

- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http - stateless transport, JSON responses, mirrored headers, origin validation.
- https://modelcontextprotocol.io/specification/2026-07-28/server/discover - discovery, versions and server identity.
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools - tool schema, discovery, invocation and result/error boundaries.
- https://modelcontextprotocol.io/specification/2026-07-28/basic - request metadata and messaging patterns.
- https://modelcontextprotocol.io/specification/2026-07-28/schema - field definitions and error codes.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization - OAuth, resource indicators, PKCE and audience validation.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration - pre-registration is a supported choice; DCR/CIMD not implemented here.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery - issuer and protected-resource discovery.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices - token passthrough, confused deputy, SSRF and least privilege.
- https://blog.modelcontextprotocol.io/posts/2026-07-28/ - release context and modern/legacy changes.

The requested lifecycle page redirects to versioning; the actual server/discover and schema pages were used for the new lifecycle. The standard is authoritative for wire facts; implementation limits above are Velnavoq's choices, not claims about the protocol as a whole.
