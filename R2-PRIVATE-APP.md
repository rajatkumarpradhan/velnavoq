# R2 private typed apps

This release extends the fixed typed D1 backend. It is not arbitrary full-stack execution or Apper parity.

## Contract

Version 1 remains public read/create with owner administration. Version 2 requires exact owner review of `{version:2,dataClass:"non-sensitive",auth:{type:"email-password",sessions:"persistent"},tables:[{name:"clients",fields:{name:"string",amount:"number",paid:"boolean"},permissions:{read:"owner",create:"owner",update:"owner",delete:"owner"}}]}`.

Auth mode changes on an existing backend are denied. Typed additive schema changes only. Every private row query is scoped by project, table and authenticated app user. User-supplied ownership fields are denied. Owner-console and MCP access to private rows are denied. Eight tables, twelve fields each, 1,000 accounts per project, 5,000 rows per user, 100 rows per list, 4KB row/body. Lists are bounded, not a complete reporting/export API.

## Browser boundary

The stable release route serves trusted shell code. Generated HTML runs in `sandbox="allow-scripts"`, without same-origin, forms, popups or storage. Guest CSP denies network connections. The shell only handles messages from its own opaque child, validates fixed actions, and only calls its own project path. Passwords, cookie tokens and CSRF values never enter the guest. Cookie paths are routing, not a security boundary; opaque guest origins plus the constrained trusted shell are the browser boundary. Server row ownership is the data boundary.

SDK: `velnavoq.auth.me()`, `.signIn()` (opens trusted shell dialog), `.signOut()`; `velnavoq.data.list(table)`, `.create(table,row)`, `.update(table,id,row)`, `.remove(table,id)`. Data lists return `{rows:[...]}`. Listen for parent `vln-auth-changed` to reload. Use button click handlers, not guest form submission. The SDK is injected before generated scripts, after the head/doctype. Generated code may request its own signed-in user's records; do not treat untrusted application code as unable to see its own data.

Persistent sessions have Secure, HttpOnly, SameSite=Strict cookies, project-bound hashes, CSRF, explicit renewal and logout. Passwords are stretched in the trusted browser shell with PBKDF2-SHA256 600,000 iterations; the Worker stores a salted verifier hash. The verifier is password-equivalent. HTTPS is required. Client cost enforcement is not a server-side password policy. Public registration has rate/account caps but no verified-email ownership. No email verification, forgotten-password recovery or MFA. Use unique passwords and non-sensitive records only. No statement that this is appropriate for financial, health or regulated data.

Static preview deliberately has no backend session. Its SDK returns signed-out/unavailable, never fabricated data success. Private feature acceptance is on the activated release. Static check/repair validates syntax/assets and does not prove app behavior. No automatic functional repair claim.

## Acceptance

Real D1 tests cover register/login/logout/renew, immutable ownership, CRUD, cross-user and cross-project denial, origins, duplicate cookies, wrong verifier, exact schema review and source approval/build/HTTP release/activation. Headless mobile browser covers the injected SDK, trusted PBKDF2 registration, save/reopen, two users/projects, sandbox parent/cookie/API denial and logout. Test fixture starts empty and labels all QA records. No external AI-client generation or actual handset performance claim.

## Deployment

Apply `deployment-target/private-schema.sql` to the existing isolated target D1 before deploying the target Worker, then deploy the controller UI/Worker. Do not create a new resource or enable a paid plan. Existing version-1 backend data remain unchanged. Existing R1 controller migrations stay unchanged. A private app only starts after exact backend consent, healthy source release and activation. No new account, paid provider or secret is required.

Public references inspected: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie ; https://developers.cloudflare.com/workers/platform/limits/ ; https://apper.io/learn/docs/mcp/apper-mcp-connector .
