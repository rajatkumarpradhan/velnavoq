# Part 5: identity and multi-tenancy
Velnavoq by Drayvenn Lab | 9 October 2026

## Ready
Real localhost password login, hashed server-side sessions, expiry, logout and own-session listing/revocation. Workspace creation atomically adds the creator as owner. Existing-account membership add/list/role change/removal. Project creation, workspace ownership, authenticated creator provenance, access and permanent deletion with exact name confirmation. UI workspace/project creation, membership management, session management and project deletion connect to these APIs. No client-side decision substitutes for a server permission check. Membership additions do not send invitations or create a new external account.

## Roles
| Operation | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| Read workspace members/projects/proposals/audit | yes | yes | yes |
| Create project or propose source changes | yes | yes | no |
| Approve/reject proposal | yes | no | no |
| Add/change/remove workspace membership | yes | no | no |
| Delete project | yes | no | no |
| List/revoke own sessions | own only | own only | own only |

Projects belong to the workspace, not a client-supplied user. `created_by` records who created a project; it does not bypass workspace roles. Existing projects retain NULL creator provenance rather than invent a creator. Last-owner protection is a database trigger, including concurrent removal/demotion; at least one owner must remain. Removing membership cuts access on an already-active session immediately.

## Request chain
Except public health and credential entry, every API request calls server identity first. Mutations require exact origin and session-bound CSRF plus rate limits. Workspace membership is read from D1; project access resolves its real workspace; operation role is then checked. Unknown/cross-tenant resources fail 404. Session expiry/revocation fails 401. Password entry stays localhost-only pending approved production identity. Client hash workspace/project IDs and disabled buttons supply navigation, never permission.

Membership mutations require an authenticated workspace owner. Email targets must be existing accounts. Session revocation SQL includes the authenticated user ID. Project deletion requires owner role and exact name, records audit and deletes atomically. Foreign-key cascades remove proposals and approved revisions; deleted project IDs cannot read or mutate. Audit records remain within the workspace, including deleted projects. Server activity feed uses a LEFT JOIN so deleted-project history is not silently lost.

Migration `0003_identity_membership.sql`: creator provenance and last-owner triggers. No new cloud resources.

## Security research and decisions
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html : deny by default, validate permission for every request and enforce access on server-side resources.
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html : server-side expiry, session invalidation, secure cookie transport and opaque identifiers.
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html : salted expensive password hashing; existing PBKDF2-HMAC-SHA256 uses 600,000 iterations. It is locally proven, not silently enabled on Workers Free's short CPU allowance.

Retain first-party opaque database sessions and existing role/membership model rather than introduce an unapproved identity provider/account or client JWT claims. Production identity remains fail-closed, not downgraded to weaker hashing to fit a free limit. Membership change endpoints operate directly on existing users rather than implement an unapproved email invitation workflow.

## Test results
75 backend tests pass, including 14 new identity/tenant tests: modified project/workspace IDs, user A vs user B access/deletion, viewer/editor denials, owner membership changes, last-owner removal/demotion, invalid role/unknown member, immediate membership revocation, exact deletion confirmation, deletion cascades, deleted ID access/mutation, deleted-project audit scope, own-only session listing/revocation and anonymous mutation rejection. Existing expiry/CSRF/origin/rate-limit/secure-cookie tests remain green.
39 browser checks pass. Browser suite uses actual temporary Worker/D1 data, not mocked product records: workspace and project creation through UI, project deletion, membership form and session panel, plus previous authenticated switch/search/logout/expiry/layout checks. UI production build and 262 UI regression checks pass; npm audit reports 0 vulnerabilities. Actual mobile creation/member screenshots inspected. No public account or deployment created.

## Remaining
Public authentication is still explicitly unavailable (503). This part does not claim production identity rollout, verified email, MFA, recovery or invitation delivery. Enabling a production identity provider needs a user-approved account/configuration and free-plan verification. No spend or security-account setting changes. Next is only the next user-directed part.
