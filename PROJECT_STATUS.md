# Project Status

_Last updated: 6 November 2026 (Philippine time)_

**Current phase:** Phase 5 — AI Tutor (core tested live ✅; backup AI and handwriting reading still to do). Phases 2–4 complete ✅

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
Pharmacology-01 Notes (15 MB) is photographed handwriting — only a little text could be read. Added automatic
shrinking of photo-heavy files (D-028) and page-by-page photo detection (D-029). Handwriting reading → Phase 5.


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

## Phase 5 progress (AI Tutor)

Built and published 6 Nov 2026:
- Groq free AI connected (key stored only in Supabase secrets; Zero Data Retention on at Groq).
- `tutor` server function: checks the daily limit (10 answers per student, admin unlimited), searches the shared library,
  answers with numbered sources [S1], forces Clinical Mode for safety topics (doses, emergencies, eclampsia, etc.),
  backup model if the main one fails, saves the conversation and a short "where we left off" summary.
- AI Tutor screen: Tea/Clinical switch, subject focus, answers left today, saved conversations (open, delete),
  quick-start chips, source list under each answer, safety note, microphone (Chrome/Edge) and "Listen" button.
- Dashboard: Continue Studying button and Recent Study Sessions.
- Admin overview: AI Tutor use (counts only — conversations stay private).

Tested: Groq reachable (11 models); library search finds the P1 reviewer; safety topic switches to Clinical;
type-check, lint, 17 automatic tests, clean production build ✅.
Live test by Erika as Test Student (6 Nov): answers with library source (P1 reviewer), eclampsia in Tea Mode switched to Clinical
with safety note and "not in library yet" line, fair-share counter (70/day for 1 student), cheerful device voice + voice picker,
microphone, dashboard Continue Studying, admin AI usage card ✅.
Changes after testing: related library pages shown when the AI forgets to cite; safety note on every safety answer;
fair-share daily limit (D-033); natural-voice read-aloud (D-034).

Cloudflare added 6 Nov: backup AI for the tutor + handwriting reader with "Read again" button (D-035, D-036). Tested: Erika pressed Read again on Pharmacology-01 Notes — 46 unread pages read (≈90 units/page, 4,300 units total), 70 text pieces, 0 unread pages; search now finds e.g. page 20 for "reverse transcriptase inhibitors" (score 0.998). Tutor also accepts a 0.80+ match when the page contains a distinctive word from the question (drug names).

## Known problems

- Fixed: the first live invite failed ("Database error creating new user") because the sign-up guard checked a mark Supabase adds only after creating the account. The guard now checks a server-only invitation list.


- Vercel's first build failed because a test file was included in the app's type check. Fixed the same day; tests now run separately (`npm test`).
