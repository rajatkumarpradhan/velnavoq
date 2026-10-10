# Part36: Account dynamic registration compatibility

Observed live failure reported by operator: Grok discovery succeeded then account register400, no authorize. Exact rejected metadata values were not captured; which old restriction caused it remains unverified.

Registration now accepts inert extension metadata, including scope/client/logo/contact/software metadata. Client name optional (AI connector default). One to ten unique safe redirect URIs retained; HTTPS or loopback HTTP only, no credentials/fragments. Grant/response/auth metadata normalized to authorization_code/code/none. No refresh support claimed or enabled. No secrets created. Metadata ignored, not fetched or trusted.

Each authorization must exactly match one stored redirect. The chosen callback is persisted on consent, displayed in review, bound at token exchange and used for callback. Wrong registered sibling redirect is not enough to redeem a code. PKCE S256, state, exact scopes, resource and owner approval remain enforced. Legacy clients/consents backfilled.

Omitted resource defaults to account /mcp; provided resource mismatch is refused. Omitted authorize scope means all advertised account scopes presented for explicit review, not permission already granted. Unknown/empty/duplicate scope requests return invalid_scope. Registration scope is inert, never a grant. No project/Autopilot access without existing approvals.

Bad registration responds RFC7591 error and error_description (invalid_redirect_uri or invalid_client_metadata). Logs include fixed rejection reason, recognized metadata key names and unknown-key count, never metadata values or arbitrary unknown key text that might itself embed secrets. Valid registration does not log supplied values. Existing body/rate/registration caps remain.

Apply migration0028 after0027 before control deploy: redirect-list client column, chosen consent callback column and backfill, immutable consent callback trigger. No target/UI change. Preserve live bindings/settings/signup=true/adapters. Reconnect with real Grok while safe logs active, confirm register201 then unsigned authorize/login/consent/token, tools/list and request call. Do not claim connector fixed before this actual sequence.

Local tests: Grok-like metadata, refresh negotiation, missing name, multiple redirects/second callback, sibling callback rejection, PKCE, missing resource/scope consent, safe redirect rejection, loopback, unknown scope rejection, key-only logs. Source reference https://www.rfc-editor.org/rfc/rfc7591 . No external Grok success established by these tests.
