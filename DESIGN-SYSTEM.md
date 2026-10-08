# Velnavoq Part 3 design system and application shell
by Drayvenn Lab | 9 October 2026

## Identity and tokens
Dark technical workspace with one consistent navy/charcoal surface family and mint accent. Original compact V mark; no old product branding. System sans stack avoids web-font loading/privacy dependency; monospace for source/logs. Main headings 28-46px, hero 44-86px, body 14px, metadata 10-12px. 8px spacing grid, 6/8/14/16px radius hierarchy. Hairline boundaries rather than heavy glass. No backdrop-filter or mobile blur. Panels use one short opacity/6px entrance animation; reduced motion disables every transition/animation.

## Implemented reusable components
Button (primary/secondary/quiet, hover/focus/active/disabled/busy); Badge (neutral/good/warn/error); Panel; Empty; Modal (native dialog, Escape, focus trap); Field; Notice; responsive sidebar/header; toast with dismissal; command palette with search, keyboard shortcut and real route navigation. Native inputs/selects have focus/disabled/validation behavior. Code/logs use monospace. Navigation current-page styling is explicit. Terminal has no fabricated command output. Empty source editor/agent layouts do not load invented code/messages.

## Screen shell coverage
30 routes: landing, sign-in, onboarding, dashboard, workspaces, projects, create, project overview, AI workspace, editor, files, terminal, preview, logs, repair, review, approval, MCP, permissions, environment, deployment, releases, rollback, settings, account, usage, security, 404, 500, offline.
Distinct landing/dashboard/auth/project-creation/editor-agent/terminal-log/usage/security views exist. Remaining service screens use the common title/status/empty-state composition. These are navigation shells, not completed feature screens. Detailed diff viewer, actual code editing/diagnostics, tooltips, team onboarding, credential forms and running-agent/build/deployment activity are not implemented; require real data/services in later parts. No placeholder API or fake project/build/model/deployment response is used.

Sign-in and create forms only report unavailable setup locally, do not send/store credentials or create records. Published usage references are distinguished from actual measured account usage. Error routes are named design states, not a claim a server incident occurred. No runtime/provider feature activated.

## Layout and verification
Mobile 360/390/412, tablet 768, desktop 1440, ultrawide 2560. Mobile header 68px, non-sticky; sidebar collapses to accessible toggle, command palette remains available, panels stack. No main/header overlap or document horizontal overflow in viewport tests. Screenshots inspected at 360 mobile, 412 landing and 1440 desktop. These are Chromium viewport tests, not physical OnePlus/Safari checks.
43 browser checks cover 6 viewport layouts, 6 axe WCAG-tagged audits, command-palette navigation and all 30 route overflow checks. Automated audits do not establish full WCAG compliance. Native dialog keyboard behavior and focus-visible styling exist; deeper screen-reader/real-device validation remains pending. CSS/JS production build inspected; no deploy.

## Run
`npm run ui:dev`, `npm run ui:build`, `npx playwright install chromium`, `npm run ui:test`.
Backend regression remains a separate `npm run check`. UI assets are not bound to the API Worker yet, so API CSP does not silently allow untrusted scripts or published preview.
