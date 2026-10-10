# Part 33: One connector, AI requests, owner approves

The account URL remains `/mcp`. Connect once, approve the named client/callback/scopes and metadata/request consent. Initial project and creation-workspace checkboxes are optional; leave them empty for request-then-approve. Existing Part32 tokens default to no new request permission: reconnect once to accept it.

## AI workflow

1. `velnavoq.list_access_targets`: only owned project/workspace names and IDs, no files/data/secrets. Available only after explicit account request consent.
2. `velnavoq.request_project_access` with projectId and a subset of token scopes, or `velnavoq.request_create_project` with workspaceId, name and exact project scopes. Creation requires the account projects.create scope, but not a blanket workspace creation grant.
3. Request returns pending, requestId, expiry and the MCP page URL. AI asks the owner to open it. Nothing is created or granted yet.
4. Owner sees the client, exact target/name/workspace and operations, approves or denies one card. No native confirm popup. Approval is an authenticated, CSRF-protected exact digest/params action.
5. AI calls `velnavoq.request_status`; approved returns projectId. Same token can now use only the approved scopes for that project. No per-project reconnect. Denied/expired means stop, not automatic retry.

Metadata listing is disclosed during the OAuth review. Prior tokens do not receive this permission automatically. No all-project/future-project blanket grant is added. Newly created or existing projects each need exact request approval, not pre-ticking on OAuth.

## Bounds and isolation

- Owner-only targets, no other account metadata or access. Owner role rechecked at approval and tool calls.
- Requested scopes must be a nonempty subset of account token scopes; no billing, secrets or account-security scope. Existing project grant cannot be silently widened; reconnect to change it.
- Requests expire after 10 minutes or token expiry, whichever is earlier. Account token remains one hour, no refresh token. Expired connector needs reconnect; uninterrupted permanent authorization is not implemented.
- 20 new requests per token per hour, exact pending request deduplicated. Existing rate caps unchanged.
- Project creation only after approval, quota checked and atomic 10/workspace cap, 40k token budget. No paid resource introduced.
- Atomic one-time request claim stops concurrent replay and duplicate creation; immutable request parameters and finished status.
- Derived child grant revokes with account token and can be individually revoked in project MCP settings. Revocation/role loss removes project access. Revocation invalidates pending approvals.
- Autopilot stays OFF. Existing build/source apply, backend and release approval gates remain. This is project permission approval, not a unified schema/files/build approval card or proof Grok has completed an app.

## Deployment

Source-only handoff. Apply `migrations/0027_account_mcp_requests.sql` after 0026 and before updated control/UI. No target Worker change. Preserve live bindings/secrets, registration setting and adapter bytes. Then check live OAuth consent, request card, exact approval and same-token project access, cross-account rejection, creation quota/replay/revoke. Real Grok connector behavior remains unverified; local reference-client tests do not prove external installation. Mobile evidence uses isolated synthetic fixtures.
