# Project Status

_Last updated: 6 November 2026 (Philippine time)_

**Current phase:** Phase 4 — Shared library & storage (Phases 2 and 3 complete ✅)

## Done

- Phase 1 plan approved (Nurse Mira – Phase 1 Plan doc).
- Design direction chosen: E-Skool-style layout, blue and white with a warm yellow accent, greeting "Good morning, Nurse (name)".
- GitHub repository `nurse-mira` created; Claude has access.
- Supabase connected to Claude; project `nurse-mira` created in Singapore (free plan).
- Database foundation: accounts and roles, invite-only sign-up, curriculum with the 26 subjects, student subject choices (any year), privacy rules.
- App: login page, signed-in front door, Phase 2 admin and student homes with the time-of-day greeting, sign out, loading indicators.

## Tested

| Test | Result |
| --- | --- |
| Stranger cannot create an account | ✅ |
| Invited student gets a student profile | ✅ |
| Student sees only their own profile and subjects | ✅ |
| Student cannot make themselves admin or change another student | ✅ |
| Irregular student can pick 2nd- and 3rd-year subjects | ✅ (test 6, database level) |
| Student cannot edit the curriculum; signed-out visitors see nothing | ✅ |
| 26 subjects loaded, correct years and semesters | ✅ |
| Greeting: morning/afternoon/evening, "Nurse" added once, admin without "Nurse" | ✅ |
| App type-check, lint and production build | ✅ |
| Live site at nurse-mira.vercel.app; signed-out visitors go to the sign-in page | ✅ |
| Test 1: administrator login on the live site (eriah.businessdgte@gmail.com has the admin role) | ✅ |

## Phase 3 progress

Built, published and tested live by Erika on 6 Nov 2026 (test student "Test Student" kept for Phase 4):
- Blue sidebar layout (E-Skool style) with "Soon" labels for later features; top search bar; mobile menu.
- Admin Overview (counts, quick actions, recent activity), Students list (search, filters), Invite student
  (one-time setup link + ready-to-send message), student page (details, subjects, setup/reset link,
  turn off/on, permanent delete with email confirmation).
- Curriculum page (view only; shows how many students take each subject).
- Setup-link page → create password → 5-step onboarding → student dashboard, My Subjects, Profile (also for admin), Search.
- Database tests: student onboarding saves; students can't edit others or read the admin log; admin can edit
  students and subjects but can't change roles through the app; deleting a student removes their subjects.

Live tests passed (Erika): invite → setup link → password → onboarding → dashboard; irregular subject
selection (Second Year student added NCM 112) saved and visible to admin (tests 2, 3, 5, 6).

Curriculum editing built: edit subject title/description, retire/restore subjects (kept in old records),
add future subjects, add/rename/retire topics. Database tests: admin can edit; duplicate topics blocked;
students can read but not change topics.

Phase 3 checkpoint passed (6 Nov 2026): Erika added topics "Preeclampsia" and "eclampsia" to NCM 109 live.

## Phase 4 progress

Update (6 Nov): one shared library — no private uploads; all students can browse it (D-027).
Erika's live test: two reviewers uploaded as Test Student, both read and fully indexed (12 and 4 parts).


- Upload: shared reviewer vs private document, sharing notice + permission tick box, file read in the browser
  (PDF incl. scanned pages, Word, PowerPoint, text, photos via OCR), suggested title/subject/topic,
  duplicate check, upload → save text → index with progress, clear errors and Retry.
- Search index: Supabase Edge Function `embed` (free gte-small model, small batches for the 2-second CPU limit)
  plus keyword index.
- My Library (students): My uploads and Shared library tabs, search/filter, download when allowed,
  edit/delete own uploads.
- Shared Library (admin): filters (subject, year, semester, uploader, status, type, processing), bulk
  archive/restore/delete, download on/off, edit, duplicates panel.
- Storage (admin): file and database meters with 70/80/90% warnings, by semester, by subject, largest files,
  archive a semester, "keep text only" for archived files, export the shared library as .zip.
- Permanent deletion (Edge Function `library-files`) removes original file, text, index and record; shows
  what will be deleted and the space recovered first. Deleting a student removes their private documents.
- Database tests (17): Student B finds Student A's shared reviewer text; private text hidden from other students
  and from the admin; students can't allow downloads, archive or edit the index; duplicates detected without
  revealing private files; archived text stays searchable; deleting removes the index.

## Known problems

- Fixed: the first live invite failed ("Database error creating new user") because the sign-up guard checked a mark Supabase adds only after creating the account. The guard now checks a server-only invitation list.


- Vercel's first build failed because a test file was included in the app's type check. Fixed the same day; tests now run separately (`npm test`).
