# Part39.2: Preview popup opener policy

Control HTML asset header changes from Cross-Origin-Opener-Policy:same-origin to same-origin-allow-popups. The former severs the deliberate cross-origin preview popup's window.opener, so the host cannot authenticate the control handoff. The new policy keeps intentional popups that do not opt into stronger COOP, while not using unsafe-none for the control page. Authenticated API/error responses retain same-origin and same-origin resource policy. API JSON is not navigated for the preview.

All preview authentication/isolation gates unchanged: separately configured origin, exact window source/origin/unguessable nonce, transferred private MessageChannel, opaque allow-scripts sandbox without same-origin, no app cookies/secret/privileged API. Host allowlist remains deployment-specific. UI permits deliberate popup relation; no cross-origin isolation guarantee is claimed. This app does not use SharedArrayBuffer or COEP.

Real Chrome at390px viewport reproduced previous policy: deployed host opener null. With allow-popups and synthetic intercepted control HTML at the exact control origin, the same live deployed host retains opener, nonce/channel completes, ready event and actual isolated synthetic DOM verified. No logged-in owner session/source touched; not a physical handset test. Screenshots inspected. Headers/config regression verifies API policy remains same-origin. Deploy owner still must verify rebuilt live assets and real project flow.

Only control static assets need rebuilding/deploying. No migrations, target/preview host, paid resource, health-gate or API behavior changes. Parent routes deployment.
