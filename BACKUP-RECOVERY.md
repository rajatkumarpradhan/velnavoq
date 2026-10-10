# Backup, restore and recovery (Part 25)

Rule: **a backup that has never been restored is not verified.** Below, every layer says plainly whether a restore was actually run, where, and what is still NOT RUN.

## What is protected, and how

| Layer | What it covers | Mechanism | Restore proven here? |
|---|---|---|---|
| Source history of one project | every approved version, file contents, digests | In-app **project export** (`GET /api/projects/:id/export`) and **restore into a new project** (`POST /api/workspaces/:id/import`, workspace owner only) | **Yes.** `tests/recovery.test.ts`: export from one D1 database, import into a different empty one, files, versions, digests, approvals and foreign keys compare equal; the restored project accepts new work |
| Whole database file | all tables, indexes, triggers | `scripts/backup-local.py` (consistent copy + integrity + FK check) plus `scripts/restore-drill.py` (manifest with SHA-256 and row counts; restore refuses a corrupted backup or edited manifest) | **Yes, locally** on a SQLite copy built from all 20 migrations (`npm run backup:drill`, 9/9). **NOT RUN** against a real D1 database (no account access in this Part) |
| D1 point in time | the live database, to the minute | Cloudflare D1 Time Travel, always on; 7 days on the Free plan (30 on Paid), 10 restores per 10 minutes. Source: developers.cloudflare.com/d1/platform/limits | **NOT RUN.** Needs the Cloudflare account. Not exercised |
| Weekly D1 export | the live database, off-platform copy | The existing weekly backup job and `scripts/check-backup.py`. This Part did not change or touch it or its token | `check-backup.py` still passes. A restore of an actual weekly export into D1 is **NOT RUN** here |
| Build artifacts | build output | Not backed up. They are rebuildable from source; the 600 KB cap and expiry are unchanged | Rebuild path covered by existing build tests |
| Secrets and environment values | secret values, env values, sessions, tokens, AI logs | **Deliberately excluded** from exports. After a restore, re-enter secrets and env values | Test asserts a secret reference is absent from the export |

## RPO, RTO, frequency, retention

These are targets plus what was measured. Measured numbers come from a tiny local database and say nothing about a large production one.

| Item | Value | Basis |
|---|---|---|
| RPO, one project's source | time since the user's last export; the export is cheap (20 per project per day) so export after each release you care about | design |
| RPO, live D1 | about 1 minute, within the last 7 days | Cloudflare doc (Time Travel), not exercised |
| RPO, off-platform copy | up to 7 days | existing weekly export |
| RTO, project import | seconds to a minute for a normal project (up to 8 MB, 200 versions) | local test, 10 tests run in about 6 s including setup |
| RTO, whole-database file restore | measured 5 ms restore and 49 ms backup for a 0.7 MB file | `npm run backup:drill`. Real D1 restore time is **not measured** |
| RTO, human-driven recovery | plan for about 30 to 60 minutes including noticing, deciding and checking | estimate, not measured |
| Backup frequency | Time Travel continuous; weekly export; project export on demand | |
| Retention | Time Travel 7 days (Free). Weekly exports: keep the last 4 (recommendation; the existing job's own retention was not changed by this Part). Project exports: held by the user, not stored by the app | |

## Recovery procedures

**1. A project's files were deleted or damaged.** Versions are immutable, so restore an earlier one: versioning restore creates a pending proposal you approve (Part 14). If the whole project is gone, import your last export: it creates a **new** project named "... (restored)", never overwrites, and is all-or-nothing.

**2. A job is stuck.** Builds and terminal runs hold the one-job-at-a-time slot. `GET /api/projects/:id/recovery` shows stuck and failed jobs and the next step in plain words. `POST /api/projects/:id/recovery/jobs` closes jobs that passed their deadline as `timed_out` (build, terminal, deployment) and leaves live jobs alone. 30 checks per hour per project. A failed job is simply started again through the normal button; quotas from Part 24 still apply.

**3. A bad deployment.** Roll back the live release: `POST /api/projects/:id/deployment/rollback` (Part 15). It shares the deploy budget. Releases are immutable records, so the earlier artifact is redeployed, not rebuilt.

**4. A bad migration or a mass delete in D1.** Use Time Travel: note the current bookmark, restore to a minute before the mistake, check, and keep the earlier bookmark (restores do not delete older bookmarks). Needs the Cloudflare account. **NOT RUN.**

**5. The database is lost or unreadable.** Restore the newest verified export into a fresh D1 database, apply the migrations, and run the drill logic: check digest against manifest, integrity check, FK check, row counts. Then re-enter secrets. Only the file-level steps were proven (see table).

**Verifying a restore (all layers):** the digest matches the manifest, `integrity_check` is `ok`, `foreign_key_check` is empty, row counts match, the newest version reads back, and new work can still be approved.

## Limits stated once

- Local-only. No live D1, no Time Travel, no weekly-job restore was run. Those three rows say NOT RUN and stay NOT RUN until someone with the account does a drill.
- Deployment rollback and versioning restore are older features. Part 25 documents them as recovery steps and exports/restores source; it did not re-implement them and found no gap in them. A rollback drill against a real public target was not run.
- The export holds source only. Releases and deployments are not exported; redeploy after restore.
- No UI page was added for export/import/recovery; the API and `npm run backup:drill` are the interface.
- Only owners can import (the approval step is owner-only by design). Editors and viewers can export.
- Tampering is detected through digests inside the file. An attacker who can rewrite the whole file and its manifest together is not stopped (no signing key by design: free-only, no key management).

## Where the code is

`src/recovery.ts`, `tests/recovery.test.ts`, `scripts/restore-drill.py`, new limits `exports.day`, `imports.day`, `recovery.sweeps.hour` in `src/quota.ts`.
