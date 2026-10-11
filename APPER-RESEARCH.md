# Apper model and Velnavoq gaps

Research checked 12 October 2026. Recommendation: copy the workflow concept, not branding, code or security promises. Use the AI client's MCP access to create and maintain the app; Velnavoq must provide the real managed backend, review, build, preview and publish infrastructure.

## Verified official documentation

Apper connects with OAuth 2.0 over Streamable HTTP. MCP endpoint documented as https://mcp.apper.io/v1/connect. The official tool table currently lists 30 tools; the homepage illustration says 28. The documentation is the implementation lead, and the illustration is not an authoritative tool count.

- Apps/files: search_apps, create_app, get_create_app_instructions, get_edit_app_instructions, get_design_directives, get_project_tree, read_files, write_files, patch_files, apply_patch, delete_files.
- Build/preview: get_build_status, preview_app.
- Database: get_backend_schema, get_backend_schema_filtered, connect_database, update_database, get_rls_policy_instructions.
- Functions: create_edge_function, get_edge_function, update_edge_function, delete_edge_function, list_edge_functions.
- Secrets/config: create_secrets, list_secrets, delete_secret, get_env_keys, set_env_key.
- History/version: generate_message_id, check_mcp_version.

Creation starts with sample data when needed. Preview and changes occur in the AI conversation. connect_database permanently replaces the sample-data layer; this is explicitly irreversible. Continued edits include database structure, permissions, server functions and configuration. Secret values are entered in the Apper dashboard, never returned to the AI; names are visible.

ChatGPT setup: Settings / Apps, Developer Mode when required, add custom MCP app, sign in/approve, enable in conversation. Plan/workspace policies can restrict access and writes. Claude setup: Customize / Connectors / Add custom connector, URL, Connect and OAuth, then enable connector in conversation; organization approval may be needed. These docs do not prove universal one-tap installation or Grok support.

## Pricing and security claims

Apper says it adds no AI-credit markup and charges for backend hosting. Its pricing page shows a Free tier with 5,000 records and 100MB storage; Team is $15.99/month billed annually, with 1M records and 5GB. Do not infer total, tax, currency conversion or checkout terms from these headlines.

The page claims two-level database/server enforcement, private-by-default permissions, table/field rules and team roles. It also contradicts itself about backups: plan comparison restricts multi-region backups, while the FAQ says every plan has them. Integration/self-account/sandbox features and roadmap ETAs are mixed with live features. No independent audit or production load test was performed here. Those claims must not be transplanted into Velnavoq marketing.

## Existing source compared with Apper

| Area | Velnavoq source today | Remaining gap |
| --- | --- | --- |
| MCP/OAuth | Account/project endpoints, PKCE, dynamic registration, owner consent, revocation | Real external-client acceptance and simpler app creation outcome |
| Source | Bounded static files, digest-based patches and approval, optional scoped automation | No npm/framework/general server runtime |
| Preview/checks | Separate-host sandbox, server static validation | Live host setup, functional browser acceptance, safe backend-aware preview |
| Database | Reviewed additive typed D1 schema; public read/create; owner admin | App-user private data, roles, tenant boundary, richer migrations |
| Publish | Immutable artifacts, exact-file health, releases and rollback | Actual free resource setup after deletion, end-to-end production verification |
| Functions/secrets | Encrypted environment secret store, secret scanning; bounded fixed API | No general edge functions or arbitrary integrations/billing |
| Login | 365-day opaque sessions, renewal, timer clamp, revoke | Production close/reopen test on real user device |

The user's requested persistent login already exists in source; stale landing text said 30 minutes and was corrected in R1. Source alone does not prove deployed behavior.

## Evidence coverage and source ledger

1. Apper official MCP reference: https://apper.io/learn/docs/mcp/apper-mcp-connector . Tool names, OAuth/transport, data switch and secrets. Primary docs, high confidence for documented contract only.
2. Apper official ChatGPT guide: https://apper.io/learn/docs/mcp/apper-for-chatgpt . Setup, plan/workspace limits, no unrelated conversation access. Primary docs.
3. Apper official Claude guide: https://apper.io/learn/docs/mcp/apper-for-claude . Setup, organization approval, OAuth. Primary docs.
4. Apper pricing: https://apper.io/pricing . Pricing model/limits and conflicting backup statements. Vendor pricing, current fetched page; not checkout verification.
5. Apper roadmap: https://apper.io/roadmap . Monetization, isolation and integration claims mixed with ETAs. Vendor marketing; not shipped-feature proof.
6. Apper homepage: https://apper.io/ . Workflow, publishing/hosting and 28-tool illustration. Vendor marketing.
7. AlternativeTo listing: https://alternativeto.net/software/apper--ai-app-and-website-builder/about/ . Directory has no reviews/comments and was contributed by Apper Team, updated 8 October 2026. Not independent validation despite separate domain.
8. Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/ . Free requests 100,000/day, CPU 10ms/request; parsing/auth may exceed that. Primary infrastructure docs, not proof the owner's deployment stays below caps.

Coverage includes primary product documentation, vendor pricing/marketing, directory/community evidence and primary infrastructure documentation. Independent performance/security evidence for Apper was not found in these sources. Public source files only contain product research and code, not user account details, private transcripts or secrets.
