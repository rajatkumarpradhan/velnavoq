# Part 9: persisted browser code editor

CodeMirror 6, MIT licensed, is loaded only for a selected authenticated project. Editor libraries are free and carry no commercial-license gate. License texts are retained in EDITOR-LICENSES.md. Sources: https://codemirror.net/6/ and https://github.com/codemirror/dev/blob/main/LICENSE .

The file tree reads actual D1 source snapshots. Open-file tabs retain unsaved buffers, syntax highlighting and undo history operate in CodeMirror, and native search/replace supports regex and keyboard shortcuts. Ctrl/Cmd+S saves a source version; Ctrl/Cmd+F searches; line navigation selects an actual document line. JSON formatting is implemented with JSON.parse/stringify only. Other languages explicitly have no formatter.

Diagnostics are JSON syntax errors and CodeMirror JS/HTML/CSS parser markers only, not TypeScript, build, dependency or runtime errors. Code is never executed. A diagnostic-free file does not mean the app builds or runs.

Owner manual saves use optimistic project revision, snapshot digest and individual file digests. CREATE/MODIFY are allowed, subject to Part 8 bounds and security. Save is a single D1 transaction: immutable approved proposal, revision snapshot, file versions and audit. Failure rolls everything back. Editors/viewers can inspect but cannot directly approve a source revision. DELETE/RENAME remain explicit reviewed patches, not manual save actions. Whole-repository rewriting remains rejected for multi-file projects; save smaller sets of changes.

Stored AI proposals are loaded, shown as previous/proposed positional line comparisons and approved only with exact source and patch digests. Destructive patches require a separate checkbox. This is a positional diff, not a minimal Git diff. Diff views show at most 500 lines; oversized proposed content disables approval so the truncated UI cannot authorize an incomplete review. Stale proposals and unsaved manual edits also disable approval.

Unsaved indicators, discard confirmation, browser unload warnings and hash-navigation confirmation protect buffers. There is no offline autosave and no claim of recovery after closing the tab. Existing file records containing known secrets are blocked from the editor as in Part 8. General secret detection remains limited to documented recognizable patterns.

## Mobile verification

Languages are split into on-demand chunks; CodeMirror virtualizes visible lines. No worker runtime or desktop IDE bundle is loaded. The base app and editor chunk sizes are measured by Vite, not estimated. Tests use browser viewports 360/390/412 and desktop, check overflow, header overlap, axe accessibility and screenshot pixels. A 4x CPU throttle checks actual typed input latency. This is a browser proxy, not a physical OnePlus performance certification. Full mobile device/Safari checks remain unverified.

Stress testing a 5,000-line buffer crashed the headless browser. Editing now explicitly refuses files above 50KB or 2,000 lines and prevents transactions from exceeding those bounds. Stored large files remain unchanged, not silently truncated. A 1,000-line buffer is separately tested.
