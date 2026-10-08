# Part 4: state-aware application shell
Velnavoq by Drayvenn Lab | 9 October 2026

## Implementation and decisions
The shell reads the current session from `/api/me`, memberships from `/api/workspaces`, selected workspace projects from `/api/workspaces/:id/projects`, and real audit activity from `/api/workspaces/:id/activity`. No project/workspace records are embedded in product code. Workspace/project IDs in the hash permit refresh/deep links, but are never trusted as authorization. Server membership checks remain mandatory. Missing or inaccessible selections are shown explicitly. Workspace changes clear the project. Aborted requests and workspace-bound result sets prevent stale responses from restoring a previous tenant's navigation.

Native workspace/project selects; responsive sidebar and mobile toggle; scoped breadcrumbs; command palette (Ctrl/Cmd K); record search (/ outside inputs); user-menu account and real logout; notifications based on real audit events; Alt 1/2 overview/projects; Escape dismiss; route changes focus main content. Project-specific targets are disabled without a verified project and guarded on deep links. Screen search remains separate from backend-record search. Search covers memberships and projects loaded for the current workspace, not unimplemented source-content indexing. Notifications are an audit feed, not an invented realtime delivery/read-state service.

Authenticated sign-in sends to the existing API. Session uses the existing HttpOnly Secure SameSite cookie; a separate readable same-site CSRF cookie permits logout while keeping the session token HttpOnly. Logout deletes the backend session and clears both cookies. Password stays in component memory only and is cleared after login. Expiry resets shell state. Error/retry, anonymous, authenticating/loading, empty memberships/projects/activity, invalid workspace/project and offline request failures are explicit. Unavailable service execution remains disabled.

## Backend changes
`GET /api/me` adds the authenticated user's email and session expiry. `GET /api/workspaces/:id/activity` returns the most recent 100 authorized project audit records. No migrations or new external services. Existing origin/CSRF and tenant permission checks retained. Vite localhost proxies `/api` to the local control worker; production frontend deployment and identity remain separately unconfigured. Public password login remains fail-closed 503. All authenticated browser proof here is local real Worker/D1 execution, not a public rollout.

## Research
Primary documentation consulted:
- https://developer.mozilla.org/en-US/docs/Web/API/AbortController : cancellation of fetch and response consumption.
- https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch : explicit status checks, credentials, network/error behavior.
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/dialog_role : dialog labeling and focus requirements. Native dialog retains focus trap and dismissal.
Use same-origin credentialed fetch rather than client-side fixture stores or a second authentication SDK. Native selects/dialog avoid a new UI dependency. Cancel previous requests rather than accept whichever response happens to arrive last.

## Verification
`npm run navigation:test`: 34 checks pass. Ephemeral real Worker/D1 database, actual registration/login, two memberships/workspaces and project records created via the API, source proposal approval and resulting audit notification, URL selection, project clearing, record search, authenticated command navigation, stale cross-workspace project denial, loading/failure/retry, logout revocation, login and expiry. Fault injection applies only to test transport. Test records exist only in that temporary database, never product fixtures.
`npm run check`: 61 backend tests pass; backend regression, compilation/dry-run, dependency audit.
`npm run ui:build`: frontend typecheck and production bundle.
`npm run ui:test`: 262 checks pass; all-route layout/axe checks and local editor/comparison regressions.
Screenshots inspected at 360/390/412/768/1440/2560 authenticated viewports and expanded 390px navigation. No header overlap/horizontal overflow. Automated accessibility checks are not full screen-reader or physical-device certification. Physical OnePlus/Safari not tested.

## Ready and next
State-aware authenticated navigation works locally. No public deployment, account creation outside the test database, paid service or runtime activation. Part 5 creation/onboarding workflows, production identity, project file integration, terminal/AI/runtime/preview/publish remain their own user-directed parts. Part 5 has not been started.
