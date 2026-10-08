# Velnavoq Part 3 design system and application shell
by Drayvenn Lab | 9 October 2026

## Identity and tokens
Dark technical workspace with one consistent navy/charcoal surface family and mint accent. Original compact V mark; no old product branding. System sans stack avoids web-font loading/privacy dependency; monospace for source/logs. Main headings 28-46px, hero 44-86px, body 14px, metadata 10-12px. 8px spacing grid, 6/8/14/16px radius hierarchy. Hairline boundaries rather than heavy glass. No backdrop-filter or mobile blur. Panels use one short transform-only 6px entrance animation; reduced motion disables every transition/animation.

## Implemented reusable components
Button (primary/secondary/quiet, hover/focus/active/disabled/busy); Badge (neutral/good/warn/error); Panel; Empty; Modal (native dialog, Escape, focus trap); Field; Notice; responsive sidebar/header; toast with dismissal; command palette with search, keyboard shortcut and real route navigation. Native inputs/selects have focus/disabled/validation behavior. Code/logs use monospace. Navigation current-page styling is explicit. Terminal has no fabricated command output. Empty source editor/agent layouts do not load invented code/messages.

## Screen shell coverage
30 routes: landing, sign-in, onboarding, dashboard, workspaces, projects, create, project overview, AI workspace, editor, files, terminal, preview, logs, repair, review, approval, MCP, permissions, environment, deployment, releases, rollback, settings, account, usage, security, 404, 500, offline.
Distinct landing/dashboard/auth/project-creation/editor-agent/terminal-log/usage/security views exist. Remaining service screens use the common title/status/empty-state composition. These are navigation shells, not completed feature screens. Local editor/JSON diagnostics, positional diff viewer and tooltips were added in the follow-up below. Team onboarding and running-agent/build/deployment activity require later services. No placeholder API or fake project/build/model/deployment response is used.

Part 4 connects sign-in to the existing local authentication API; public login remains unavailable. Project creation remains disabled pending Part 5. Published usage references are distinguished from actual measured account usage. Error routes are named design states, not a claim a server incident occurred. No runtime/provider feature activated.

## Layout and verification
Mobile 360/390/412, tablet 768, desktop 1440, ultrawide 2560. Mobile header 68px, non-sticky; sidebar collapses to accessible toggle, command palette remains available, panels stack. No main/header overlap or document horizontal overflow in viewport tests. Screenshots inspected at 360 mobile, 412 landing and 1440 desktop. These are Chromium viewport tests, not physical OnePlus/Safari checks.
43 browser checks cover 6 viewport layouts, 6 axe WCAG-tagged audits, command-palette navigation and all 30 route overflow checks. Automated audits do not establish full WCAG compliance. Native dialog keyboard behavior and focus-visible styling exist; deeper screen-reader/real-device validation remains pending. CSS/JS production build inspected; no deploy.

## Run
`npm run ui:dev`, `npm run ui:build`, `npx playwright install chromium`, `npm run ui:test`.
Backend regression remains a separate `npm run check`. Part 4 adds a development-only Vite API proxy. UI assets are not publicly deployed or bound to the production Worker, so API CSP does not silently allow untrusted scripts or published preview.

## Detailed Part 3 coverage follow-up
Added local scratch source editor with filename/find, line count/bytes and real JSON parser diagnostics, all explicitly ephemeral and not project persistence or execution. Added local positional diff comparison of user-entered source, with changed-line colouring and no approval effect. Added accessible hover/focus tooltips, distinct property/status/action structures for onboarding, workspaces, projects, project overview, repair, approval, MCP, tool permissions, env variables, deployment, releases, rollback, settings/account and error states. Unavailable action controls remain disabled; no dummy records, secrets or progress transitions. Language-server diagnostics, project file persistence and actual service integrations remain later work.
Follow-up browser suite: 262 checks including axe scans for all 30 routes, real scratch invalid/valid JSON input and changed-line diff regression. Screenshots inspected for editor diagnostics, input comparison and deployment-status structure on 390px. Entry animation is transform-only (no text opacity fade) to preserve contrast during movement; reduced motion removes it. No physical OnePlus test or full screen-reader certification is claimed.
