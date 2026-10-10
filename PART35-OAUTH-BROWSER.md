# Part35: Browser OAuth entry and public discovery

An unsigned, valid account authorization URL now redirects303 to the real sign-in/signup SPA. It carries the exact authorize path/query in a fragment parameter, not an external redirect. Successful password sign-in, sign-up or MFA resumes that same account authorize URL, creates pending consent and requires explicit owner approval before token issue. Resume helper refuses external/protocol-relative hosts, wrong routes, fragments and oversized input. Signup does not invent a workspace.

Public metadata: root protected-resource aliases /mcp resource metadata; root authorization-server and /mcp alias the account issuer with registration endpoint. Canonical account metadata remains unchanged. Existing exact project metadata stays public. Unknown well-known paths, including OpenID configuration (not implemented), return404 rather than UI authentication401.

Public transport, all well-known routes and account register/token/revoke endpoints support CORS wildcard without credentials and OPTIONS204. Authorization/content/protocol headers allowed and WWW-Authenticate exposed. Authenticated UI APIs receive no CORS. MCP POST Origin permits own origin and named Grok/ChatGPT/Claude web origins; other origins403. OAuth browser authorize still requires own-origin or absent Origin; normal top-level navigation sends none. No cookie-based MCP auth, no token auto-grant or bypass of exact consent.

No migrations/target Worker changes. Preserve live bindings, signup=true and adapters on control/UI deploy. Verify unsigned authorize redirects to real login; sign in resumes exact state/challenge/redirect and opens consent; approve returns to Grok; confirm tools and an actual request call. Real Grok flow remains unverified by this source handoff.

Tests cover reference authorize/login redirect-resume, public aliases and unknown404, CORS/preflight/challenge exposure, no UI API CORS and safe resume helper. Mobile screenshots are synthetic local UI fixtures, not a real signed-in Grok flow.
