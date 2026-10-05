# Build status

| Step | Scope | State |
|---|---|---|
| 1 | Setup, schema, seed, Warden + Parent auth, authorization, security basics | Code written. **PENDING verification** |
| 2 | Rooms + Students management + CSV import (students AND rooms) | Code written. **PENDING verification** |
| 3 | Room Map (2D floor plans) + Room Checking + Dashboard | Code written. **PENDING verification** |
| 4 | Parent Portal (login, password change, dashboard, history, stars, acknowledge) | Code written. **PENDING verification** |
| 5 | WhatsApp (manual wa.me) + Today's Reports | Code written. **PENDING verification** |
| 6 | Public website (10 pages) + Enquiries + Settings + manual availability | Code written. **PENDING verification** |
| 7 | Backup/Restore + Automatic cleanup (+ Warden-side Parent Account Management) | Code written. **PENDING verification** |
| 7.5 | Final Feature Completion: Rooms/Students management, CSV import screens, Warden Search, 30-Day History, Forgot Password | Code written. **PENDING verification** |
| 8 | Full verification, security tests, real DB/API checks, deployment | **NOT STARTED** (waiting for confirmation) |

## Pending verification (deferred until network/environment is available)
Nothing below has been run against real dependencies yet:
- `npm install` (package versions were chosen from memory)
- `npm run typecheck`
- `npm test` (vitest)
- `npm run db:generate` / `db:migrate` (migration files not generated yet)
- Seed, create-warden and recovery-key scripts
- Live runs of every API route against a Neon dev branch

## Step 2 endpoints (Warden session required, same-origin enforced on writes)
- `GET/POST /api/admin/rooms`, `PATCH /api/admin/rooms/:id`
- `GET/POST /api/admin/students` (`?q=&roomId=&status=active|inactive|all`), `GET/PATCH /api/admin/students/:id`
- `POST /api/admin/students/:id/move` `{roomId}`, `POST /api/admin/students/:id/active` `{isActive}`
- `GET /api/admin/students/import/sample`, `POST .../import/preview`, `POST .../import/commit` (raw CSV body)


## Rooms CSV import (part of Step 2)
- `GET /api/admin/rooms/import/sample`, `POST /api/admin/rooms/import/preview?mode=create|update`, `POST .../commit?mode=...` (raw CSV body)
- Columns: `room_number`, `capacity`, optional `floor` (must match the number-derived floor).
- `create` mode: existing room numbers are errors. `update` mode: only existing rooms, only capacity changes. No accidental overwrite.
- Sample rooms use reserved numbers 9001-9003; production (NODE_ENV=production) refuses them. The students importer likewise refuses SAMPLE-/DUMMY- codes, "Sample ..." names and @example.com emails in production.

## Step 3 contents
- Pure logic: `server/lib/room-status.ts`, `check-rules.ts`, `layout-validation.ts`
- Floor plans as data: `layouts/floor-1.ts`, `floor-2.ts` (dummy), registered in `layouts/index.ts`
- Data: `server/repos/checking.ts`; logic: `server/services/checking.ts`
- API: `GET /api/admin/dashboard`, `GET /api/admin/floors/:floor/map`, `GET|PUT /api/admin/rooms/:id/check`, `POST /api/admin/rooms/:id/vacant`, `POST /api/admin/rooms/:id/complete`
- Pages: `/admin/login`, `/admin/dashboard`, `/admin/floors/:floor`, `/admin/rooms/:roomNumber/check`
- Step 2 services now clear today's vacant/manual-complete flags when a student joins a room (new, moved in, reactivated).
- Dashboard quick actions for Search, Today's Reports, History, Backup show "Coming soon" until their steps.

## Step 4 contents (Parent Portal)
- Pure logic: `server/lib/parent-report.ts` (ack state from revisions, star summary/trend, history window, access rule)
- Data: `server/repos/parent-reports.ts`; logic: `server/services/parent-portal.ts` (every function starts from `resolveStudentAccess`, so unlinked students are a 404)
- API: `POST /api/parent/reports/:checkId/acknowledge` `{revision}`, `GET /api/parent/students/:studentId/history?range=7|30|all`
- Pages: `/parent/login`, `/parent/password` (only page reachable during a pending first-login change), `/parent/dashboard`, `/parent/history`, `/parent/stars`; student selector via `?student=`
- Warden visibility: Room Check screen shows per-student "Parent acknowledged <time>" / "saw an older version" / "not acknowledged yet"
- Small additive edits to Step 3 files: `server/services/checking.ts` (ack summary), room check page + `RoomCheckForm.tsx` (display), `messages/en.ts`
- Not built (belongs to later steps): Warden screens for creating parent accounts/linking students/setting temporary passwords (service functions exist, no UI/API yet)

## Step 5 contents (WhatsApp + Today's Reports)
- Pure logic: `server/lib/whatsapp.ts` (message text, wa.me link, primary-number availability, state from revisions)
- Data: `server/repos/reports.ts`; logic: `server/services/reports.ts`
- API: `GET /api/admin/reports/today?filter=all|needs_whatsapp`, `POST /api/admin/reports/:checkId/whatsapp-open` `{revision}`
- Page: `/admin/reports` (dashboard quick action now links to it); `components/admin/WhatsAppButton.tsx`
- The wa.me link is a real anchor built on the server from the CURRENT report; tapping it logs an "open" (revision + time) in `delivery_log`. Nothing is sent automatically; no sent/delivered/read claims anywhere.
- "Edited after WhatsApp" = newest opened revision < current report revision; the button then stays available ("Open WhatsApp (updated report)").
- Primary parent number only; missing/invalid number -> disabled button + "Parent WhatsApp number not available."
- Email / SMS shown as disabled "Currently Unavailable". No bulk send.
- Parent Portal needed no change: it already reads the live check, so an edit is visible to the parent immediately.
- PRESERVED GAP (future Warden management step, intentionally NOT built here): Warden-side parent account creation, student linking and temporary-password management UI/API. Service functions exist; no screens/routes.
- Not added: a WhatsApp button on the Room Check screen (Today's Reports is the single place, as locked).

## Step 6 contents (Public Website + Enquiries)
- Public pages (route group `app/(public)`): `/`, `/about`, `/rooms`, `/availability`, `/facilities`, `/rules`, `/gallery`, `/location`, `/enquiry`, `/contact`. The old placeholder `app/page.tsx` was removed (the home page now lives in the group).
- Call + WhatsApp: header (md+), sticky bar on phones, hero/contact sections. Numbers come from Admin > Settings (`app_settings`); an unset number hides its button (no fake numbers).
- Static content: `content/site.ts` (**PLACEHOLDER COPY - must be edited before launch**: about, facilities, rules, address, map query, gallery captions). Gallery images are generated placeholder SVGs in `public/gallery/` - replace with real photos. No upload/management UI by design. No fees anywhere ("Contact for Pricing").
- Public data whitelist: `server/lib/public-data.ts` (`toPublicRoom` -> only `{roomNumber, status}`), `server/services/public-site.ts`, `GET /api/public/availability` (no-store headers; also in `next.config.ts` for `/availability` and `/api/public/*`; pages are `force-dynamic`). Manual refresh only; no polling/realtime.
- Public availability is the manual `rooms.public_availability`; independent of student counts and of daily checking (vacant/green/red).
- Enquiry: `POST /api/public/enquiry` (write-only: no GET exists). Honeypot field `website`; per-IP limit 3/hour + 10/day using a keyed hash of the IP (new column `enquiries.ip_hash`; raw IPs are never stored). Rate-limited requests return 429. Fields: name, phone, email (optional), room type, joining date, message. Everything except email is required (message too - easy to relax in `server/lib/enquiry.ts`).
- Warden pages (new nav in the panel header): `/admin/availability` (manual Available/Full per room; shows an active-student hint to the Warden only), `/admin/enquiries` (New / Contacted / Closed + manual delete), `/admin/settings` (public Call/WhatsApp numbers).
- Admin API: `POST /api/admin/rooms/:id/availability`, `GET|PUT /api/admin/settings`, `GET /api/admin/enquiries?status=`, `PATCH|DELETE /api/admin/enquiries/:id`.
- Small additive edits to earlier files: `server/db/schema.ts` (ip_hash + index; no migrations generated yet anyway), `server/repos/rooms.ts` (publicAvailability in update, `listPublicRooms`), `server/services/rooms.ts`, `server/lib/errors.ts` + `server/http/api.ts` (new `rate_limited` -> 429), `messages/en.ts`, `app/globals.css` (marigold tokens), panel layout nav.
- NOT built (later steps): 90-day enquiry auto-delete + 30-day checking cleanup (Step 7). Backup/restore (Step 7). PRESERVED GAP: Warden-side parent account creation, student linking, temporary-password management UI/API (not needed for Step 6).
- Guard test `tests/public-privacy.test.ts`: public code never imports private repos/services, contains no fee amounts or phone numbers, enquiry endpoint has no GET.

## Step 6 preview
- `varindavan-preview.html` (published as an artifact) is a STANDALONE UI preview with demo data, not the running Next.js app. It mirrors the Step 6 pages/flows and uses content from `content/site.ts`. Its own logic was checked with 73 node assertions. It proves nothing about the real server code, database or auth, which stay PENDING verification.
- To run the REAL site locally: `npm install`, copy `.env.example` to `.env.local`, `npm run db:generate && npm run db:migrate`, `WARDEN_LOGIN_ID=... WARDEN_PASSWORD=... npm run warden:create`, `npm run dev`, then open http://localhost:3000 (public) and http://localhost:3000/admin/login (Warden).

## Step 7.5 contents (Final Feature Completion: the Warden-side gaps found in the Step 7 audit)
**Screens (all Warden-only, mobile-first, same design language; nav row now: Dashboard, Search, History, Reports, Rooms, Students, Parents, Availability, Enquiries, Settings, Backup)**
- `/admin/rooms` (`RoomsManager`): list, search by number, floor / active / availability filters, add room, edit (number, capacity, active), public Available/Full toggle (reuses `AvailabilityToggle`). Floor is derived from the room number and shown read-only. Confirmations for rename, deactivate, capacity reduction.
- `/admin/rooms/import` and `/admin/students/import` (`CsvImporter`): sample download, file check, PREVIEW with per-row validation report, create/update/error summary, errors-only filter, rooms create/update mode, explicit confirmation, commit of exactly the previewed text, success summary. Existing CSV rules and APIs unchanged.
- `/admin/students` (`StudentsManager`): server-side search (name, student code, internal ID, room) + active/inactive/all, add, edit (parent + secondary contact, WhatsApp/email), Move to Room (capacity-aware), deactivate / reactivate with confirmations, link to room checking, link to CSV import.
- `/admin/search`: room number first (exact, then prefix), then student name/code/ID; results open Room Checking; shows Warden-only data (parent number).
- `/admin/history`: last 30 days, latest first, date-wise / student-wise / room-wise views, filters (date range, room, student name/code, status, stars), student note, room note, WhatsApp opened/edited-after state, parent acknowledgement state + time, edit info (revision + time), pagination. Window is clamped to the retention period.
- `/admin/recover` (+ "Forgot password?" link on login): recovery key + new password + confirm.
**Backend added or changed (minimal, reusing existing layers)**
- NEW: `GET /api/admin/history`, `GET /api/admin/search`; `server/repos/warden-history.ts`, `server/services/history.ts`, `server/services/search.ts`.
- Pure shared logic (single source of truth, used by services AND screens): `server/lib/rooms.ts` (validateRoomNumberInput, validateCapacityInput, roomSpaceDecision, decideRoomChange, decideMove), `server/lib/student-fields.ts` (mergeStudentPatch), `server/lib/history.ts`, `server/lib/search.ts`, `server/lib/recovery-flow.ts`.
- Behaviour change: a room can no longer be renamed while checking records saved under its current number still exist (reports/room notes refer to that number); it can be renamed after they expire. Student search also matches the internal ID.
- `recoverWardenPassword` now delegates its decision order to `runRecovery` (same behaviour, unit-testable); password change + deletion of ALL Warden sessions happen in one transaction.
- Small edits: `services/rooms.ts`, `services/students.ts`, `repos/rooms.ts`, `repos/students.ts`, `services/checking.ts` (`listRoomDays`), `services/warden-auth.ts`, nav layout, dashboard tiles (Search + History now link), `messages/en.ts`.
**Tests:** `tests/room-student-rules.test.ts`, `tests/history-search.test.ts`, `tests/recovery-flow.test.ts`, `tests/phase75-static.test.ts` (per-handler Warden guard + CSRF check on every admin route, every panel page re-checks the session, public/parent code never imports Warden features, CSV commit gating, stable Student ID, recovery security). Mutation-checked: guard removal, CSRF removal, public->search import, CSV gate, move rewriting history, patch carrying room, recovery-key leak were all caught (two weak tests found and fixed on the way).

## Step 7 contents (Backup/Restore, Cleanup, Parent Account Management)
**Backup (7A)**
- Pure logic (tested): `server/lib/backup-zip.ts` (WinZip-style AES-256 ZIP written with Node `crypto`/`zlib`, no new dependency), `backup-format.ts` (what is included/excluded, column specs, retention, manifest, schema version, full validation), `backup-archive.ts` (create/open + error codes), `restore-flow.ts` (order: validate -> safety backup -> ONE transaction -> end parent sessions), `retention.ts`, `cron-auth.ts`, `parent-link.ts`.
- DB layer: `server/repos/backup.ts` (never references Warden/login-attempt tables), `server/repos/cleanup.ts`, `server/db/schema.ts` (+ `safety_backups` table: latest encrypted pre-restore copy, never part of a backup).
- Services: `server/services/backup.ts`, `server/services/cleanup.ts`. HTTP helper: `server/http/upload.ts` (4 MB limit).
- API: `POST /api/admin/backup/download`, `POST /api/admin/backup/restore/validate`, `POST /api/admin/backup/restore/commit` (needs typed `RESTORE`), `GET /api/admin/backup/safety`.
- UI: `/admin/backup` (`components/admin/BackupPanel.tsx`): password + confirm + the "password is not stored anywhere" warning; restore with validation summary, safety-backup note, typed confirmation.
- Included: rooms, students, parent accounts (with password hashes), links, settings, 30-day checks, room states, acknowledgements, WhatsApp logs, enquiries inside 90 days. Excluded: Warden account/hash, Warden + parent sessions, login attempts, enquiry IP hashes, recovery key, every secret. Contains `schema_version` (1), `exported_at`, `timezone` (Asia/Kolkata), row counts, SHA-256 of the data.
- Backup password: min 12 characters (the ZIP AES format fixes PBKDF2 at 1000 rounds, so length matters). Never stored/logged. Restore re-applies retention, so an old backup cannot bring back expired data. After a restore all parent sessions end; the Warden session and Warden credentials are untouched.
- Known trade-off: the AES-ZIP was implemented from the WinZip AE-2 spec and checked structurally (Python `zipfile` reads method 99/encrypted flags). It has NOT been opened with 7-Zip/WinZip. The app's own restore does not depend on that.
- Upload size: 4 MB (hosting request limits can be lower; a 120-student / 30-day backup is ~26 KB).

**Cleanup (7B)**
- `POST|GET /api/cron/cleanup` with `Authorization: Bearer <CRON_SECRET>` (anything else = 401, nothing deleted; no CRON_SECRET configured = always 401). Strictly Asia/Kolkata (`retention.ts`), one transaction.
- Deletes: checks, room states, acknowledgements, WhatsApp logs older than the 30-calendar-day window (kept: today and the 29 days before); enquiries older than 90 calendar days. Never touches rooms, students, parent accounts/links, settings, Warden account.
- `vercel.json` has an OPTIONAL cron entry (19:00 UTC = 00:30 IST). It is configuration only; delete it and call the endpoint from any scheduler on other hosting.
- NOT included (not requested): cleaning old `login_attempts` rows and expired sessions.

**Parent Account Management (the preserved Step 4 gap) - NOW IMPLEMENTED**
- `server/repos/parent-admin.ts`, `server/services/parent-admin.ts`, routes under `/api/admin/parents*`, page `/admin/parents` (`components/admin/ParentManager.tsx`), nav link "Parents".
- Create account (E.164 mobile + temporary password, `must_change_password` = true), reset temporary password (reuses `adminSetParentTemporaryPassword`: must-change on + sessions ended), change login number (ends sessions), link / unlink students, delete an account only when it has no linked students, "students without a parent account" list, suggestions of students that share the parent's number (the Warden ticks every link; nothing is auto-linked), a Generate button for readable temporary passwords, temporary password shown once after create/reset.

**Edits to earlier steps (integration only):** `messages/en.ts`, `server/db/schema.ts` (new table), `server/http/schemas.ts`, panel layout nav, dashboard "Backup & Restore" tile now links to `/admin/backup`.

## Tests (offline, pure logic + static source checks): 257 pass, 0 fail (Step 7.5 added 104)
Run: `VB_ROOT=$(pwd) bash tools/offline-test-runner.sh <names>` offline, or `npm test` normally. Step 7 files: `tests/backup.test.ts`, `tests/cleanup.test.ts`, `tests/step7-static.test.ts`. The runner awaits async tests (an earlier version of my stand-in did not, so async restore tests were not really executing; fixed and re-run). Mutation check: 8 deliberate bugs (skip password check, skip HMAC, open cron, off-by-one retention, UTC date, leak IP hash, skip safety backup, skip session reset) were all caught.
- Real DB tests: NONE. Real API tests: NONE. UI/browser tests: NONE (all pending Step 8).

## Executed so far (pure logic only, via node shim; vitest not installable here)
257/257 pure-logic + static tests pass (153 earlier + 39 pure logic + 65 static/authorization for Step 7.5). Real DB / API / browser tests: NONE yet (Step 8).
