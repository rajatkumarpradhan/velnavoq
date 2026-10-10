# Grok connector transport fix

Reported symptom: Grok UI showed connected without a Velnavoq login/consent screen; no Velnavoq tools in chat. No production request trace yet proves the exact client failure path.

Confirmed source defects:
- Account initialize/ping accepted unauthenticated requests, challenging only later tools. Now every account POST without valid bearer returns 401 with resource_metadata, before accept/body/RPC validation. Public discovery and OAuth endpoints stay public. Bad Origin still403; rate caps still apply.
- Missing protocol-version header incorrectly entered the future-version validator. Standard transports say assume2025-03-26 when header absent. Legacy default now accepts normal tools/list and initialized notification with no header. Unsupported explicit versions and invalid origin/session/header cases remain rejected.

Reference flow tested: unauthenticated initialize/ping/notification401; OAuth owner approval/PKCE; authenticated initialize200, initialized202, tools/list exposes request_create_project, metadata tool call200. No insecure no-auth project access introduced.

Sources verified: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports and https://docs.x.ai/developers/docs-mcp . Stateless operation and GET405 are allowed; no evidence they need changing. This patch does not add session/SSE/CORS or a refresh-token flow.

Source-only, no migration/target change. Deploy control with existing production bindings/settings. Disconnect/reconnect in Grok, observe OAuth challenge, login/consent, return, tools list and real request call. Do not claim fixed external connector until that succeeds. If logs show another failure, inspect it before adding guessed compatibility behavior.
