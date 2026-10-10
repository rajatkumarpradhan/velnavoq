# Accessibility & Responsive Quality (Part 22)

Scope: keyboard-only operation, focus visibility, semantic structure, screen-reader semantics, contrast, reduced motion, touch targets, zoom/reflow, mobile/tablet/desktop/ultrawide viewports, landscape, and engine differences. Targets WCAG 2.2 AA behavior. This file records what was measured, what was fixed, and what is not verified.

## What was tested

- Automated axe audits (tags wcag2a, wcag2aa, wcag21aa, wcag22aa) on authenticated app screens at 360, 390, 412, 768, 1440 and 2560 px widths, plus landscape phone and tablet viewports.
- Keyboard-only flows with real key events: skip link entry, navigation, dialogs, command palette, mobile nav, editor, terminal, preview.
- Focus visibility and focus restoration after dialog close / Escape.
- Contrast ratios measured from computed styles (7 text/control pairs, all >= 4.5:1 after fixes).
- Touch target sizes at 390 px (>= 24x24 CSS px minimum; primary controls 44 px).
- Zoom/reflow at 200% and 400% viewport equivalents: no horizontal page scroll, no clipped content.
- Reduced-motion preference: animations/transitions disabled under prefers-reduced-motion.
- Engine check: the keyboard and viewport suites also run under Firefox (4 checks).
- Header behavior at small heights: header is not sticky, so it never eats landscape viewport space.
- Editor, terminal, preview: scrollable regions are keyboard-focusable and reachable by Tab; no horizontal page overflow at 360 px.

## Failures found in the baseline (before fixes)

1. Editor Tab trap: CodeMirror bound Tab to indent, so keyboard users could not leave the editor by keyboard alone (WCAG 2.1.2).
2. Command palette Escape closed the dialog but dropped focus to the document body (WCAG 2.4.3).
3. Mobile navigation Escape closed the menu but dropped focus to the document body (WCAG 2.4.3).
4. Focus outlines were below visibility threshold on several controls; some control borders fell under 3:1 against adjacent colors.
5. Several touch targets were under 24 px at phone widths; dialog and long content could overflow small landscape viewports; the preview host page had no skip link or landmark structure.

## Fixes applied

- ui/components/code-surface.tsx: removed the Tab-to-indent binding. Tab moves focus out of the editor; indentation is still available via Ctrl/Cmd-] and the toolbar.
- ui/components/shell.tsx: Escape in the mobile nav returns focus to the nav toggle; removed autofocus from the palette input so focus order starts at the dialog.
- ui/components/system.tsx: Modal restores focus to the invoking element on close; Field hints are wired with aria-describedby.
- ui/components/project-editor.tsx: diff output is a focusable scroll region; file tree marks the current file with aria-current.
- ui/components/project-terminal.tsx, project-preview.tsx: output regions are focusable scroll regions with labels.
- ui/theme.css: 3 px high-contrast focus outlines, control border contrast >= 3:1 (#657b90), reflow/wrapping rules for 200-400% zoom equivalents, 44 px primary touch targets, reduced-motion media query, small-viewport dialog sizing.
- preview-host/index.html: skip link, banner/main landmarks, 44 px targets, 100dvh layout for small landscape screens.

## Verification (all local, against real Worker + D1 + built UI)

- scripts/accessibility-check.mjs: 147 checks, 0 failures (baseline run had 3 real failures: items 1-3 above).
- scripts/accessibility-evidence.mjs: 28 checks, 0 failures (contrast ratios, skip-link keyboard entry, touch targets, zoom/landscape/tablet audits, reduced motion, Firefox engine checks).
- Full regression re-run after the fixes: editor 29, navigation 39, terminal 28, build 23, preview 29, security-auth, plus typecheck, 385 unit tests and npm audit - all green.
- Test harness repairs made during this part (test code only, no app behavior change): navigation-check expected a stale heading ("Deployment" vs actual "Production deployment"); preview-check now builds the UI with VITE_PREVIEW_HOST set so the two-host popup flow is hermetic; build-check guards the delayed-chunk route against the cancel-abort race; terminal-check polls for the Run button re-enable instead of asserting it in the same tick.

## Honest limits

- No real screen reader was run (no NVDA, JAWS, VoiceOver). Semantics are verified via the accessibility tree and axe, not via actual speech output.
- No physical devices: all results are from emulated viewports in Chromium and Firefox engines. WebKit/Safari could not be run in this environment (missing system libraries).
- Zoom was tested at viewport/CSS equivalents of 200% and 400%, not with OS/browser chrome zoom on a real display.
- axe catches an automated subset of issues; manual WCAG evaluation (e.g. cognitive load, consistent help) was not performed.
- Results describe the local build; the deployed site (if any) was not re-tested.
- No WCAG conformance certification is claimed.
