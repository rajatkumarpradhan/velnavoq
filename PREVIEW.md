# Part 12: separate-origin static preview, deployment blocked

Velnavoq by Drayvenn Lab. Free code implementation, not a publicly launched preview service.

Pipeline: authenticated project -> persisted browser build receipt -> immutable artifact snapshot -> preview API -> separate browser preview host -> opaque sandboxed app frame. Requires successful, unexpired, current-revision build artifact. No fake URL, no sample generated app, no control-plane execution.

## Actual implementation

Preview creation/status/logs/restart/stop/refresh, document health, 8-second health timeout and 10-minute expiration. Fresh frame on restart; frame removed and popup closed on app-side stop/navigation. Two sessions/user, bounded 750KB rewritten document, 100 stored events, 8KB visible log. API tenant/role/initiator gates; source remains immutable. Lifecycle reports are browser-unverified, never trusted build/deploy/security evidence. Forged app health/error telemetry cannot grant capabilities or authority.

Separate host accepts a private MessageChannel only from its verified opener with a random session nonce and explicit localhost origin allowlist. Guest telemetry accepted only from current frame WindowProxy. Generated apps receive no control port. Nonce is removed from visible URL. Source is browser-memory-only on preview host; no public bucket, account secret, cookies or API bindings. Closing host loses content. URL is not shareable; reloading host requires new app handoff.

App runs sandbox=allow-scripts with no allow-same-origin. Parent DOM, app cookies, local storage, top navigation, popups/forms, Worker creation and fetch/XHR are blocked by sandbox/CSP. Host CSP, referrer no-referrer and download behavior documented in preview-host/_headers. App JS/CSS/assets become local data URLs. Meta refresh/base/embedded frames removed. Cyclic modules, CSS @import and nonliteral dynamic module imports fail explicitly. Browser behavior, not arbitrary Node/npm framework support. Resource/runtime checks do not attest application correctness.

## Important incomplete requirements

Public separate hostname deployment blocked: Cloudflare existing account dashboard loaded, but free static-upload creation returned unknown error and its one reload hit persistent human verification after over 30 seconds. No resource, token, billing or account changed. VITE_PREVIEW_HOST remains unset in production. UI honestly shows separate_preview_host_not_configured. Local tests use main localhost:5173 and separate hostname 127.0.0.1:5190. Do not claim public preview is live.

Browser-only preview is not a complete network/CPU sandbox: CSP blocks fetch and assets, but generated JS can navigate its own frame to external pages. No OS-level CPU/memory/process quotas, browser tab crashes cannot be reliably detected, and infinite guest loops may require closing preview tab. Expiration/timeout timers can be throttled/hung by browser. A real browser crash is not tested by the tab-close recovery test. Do not call those requirements satisfied. No remote server runtime or Linux shell. Guest HTTP servers unavailable.

Cookies are protected by separate hostname + opaque frame; existing main auth cookie is HttpOnly Secure SameSite Strict host-only and API mutations require origin+CSRF. Frame navigation cannot gain main-app authority. Browser/app engine security bugs are outside this proof.

## Testing

244 backend/domain tests: source-to-document transforms, cookie capability boundary architecture, missing assets, cyclic/nonliteral modules, hostile tags, artifact-required/current-build gates, tenant restrictions, error/timeout metadata, restart/stop/expiry. Browser two-host tests execute actual static app DOM, storage/cookie/parent access failures, restart/stop, thrown runtime exception, attempted privileged fetch, missing health timeout and frame removal, tab-close/manual recovery, plus 360/390/412/1440 layout/axe. Browser artifact fixture uses persisted unverified success receipt, not a fabricated trusted build; Part 11 independently verifies actual builds and ZIP bytes. Physical OnePlus/Safari untested.

## Host deployment

Upload only preview-host/index.html and preview-host/_headers as a free static asset host, separate from app origin. No project source or secret in those assets. Localhost allowed opener is intentionally fixed until a genuine main app hostname exists and is explicitly configured. Set VITE_PREVIEW_HOST to observed deployed URL only after health verification. No guessed workers.dev URL.

Sources: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/sandbox ; https://developers.cloudflare.com/workers/platform/limits/
