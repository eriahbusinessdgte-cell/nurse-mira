# Project Status

_Last updated: 6 November 2026 (Philippine time)_

**Current phase:** Phase 8 — Final testing and launch. Phases 2–7 complete ✅

## Done

- Phase 7 ✅: AI & Problems page, Settings page, tidy-up rules (D-050), security review (SECURITY_REVIEW.md). Also: Backups page (password-locked download, check, put back missing records), Overview backup reminder, daily keep-alive so the free database never pauses, Recovery Guide (RECOVERY_GUIDE.md). Tested live by Erika: backup downloaded (160 records), checked (0 missing); one Test Student planner item deleted → check showed 1 missing → put back → identical to the original.

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

## Phase 6 progress (Study tools)

- Review Center built 6 Nov (D-039): `review_sheets` table, `review` function, /review page with year/semester/subject/topic,
  six tabs (Overview, Terms, Nursing focus, Practice questions, Flashcards, Quick review), print, "Ask the AI Tutor" link.
  Tested live by Erika ✅ (subject names now shown instead of codes).
- Quizzes & Exams (D-040) tested live by Erika ✅; essays dropped (D-041).
- Case Study Builder (D-042) tested by Erika ✅.
- NCP Builder (D-043) tested by Erika ✅.
- My Planner + dashboard tasks/exams/quiz results built (D-044). Waiting: Erika's live test. Then Phase 6 is complete.

## Known problems

- Fixed: the first live invite failed ("Database error creating new user") because the sign-up guard checked a mark Supabase adds only after creating the account. The guard now checks a server-only invitation list.


- Vercel's first build failed because a test file was included in the app's type check. Fixed the same day; tests now run separately (`npm test`).

## Phase 8 — final acceptance tests (2026-11-07) ✅ 25 of 25 passed
Run live by Erika (admin + "Test Student B" in a private window), with database checks by Claude.

| # | Test | Result |
|---|------|--------|
| 1 | Administrator login | ✅ |
| 2 | Student login | ✅ (Student B set up from the invite link) |
| 3 | Account creation and invitations | ✅ |
| 4 | Student privacy | ✅ Student B sees 0 of anyone else's chats, quizzes, case studies, care plans, planner, usage; admin sees 0 of students' private work |
| 5 | Subject selection | ✅ |
| 6 | Irregular subject selection | ✅ 1st-year load + NCM 109 from 2nd year |
| 7 | Reviewer upload | ✅ |
| 8 | Automatic shared-library indexing | ✅ all text pieces searchable |
| 9 | Student B learns from Student A's reviewer | ✅ "Explain zidovudine" cited Pharmacology-01 Notes |
| 10 | Source citations | ✅ |
| 11 | Duplicate detection | ✅ second upload stopped, 1 copy stored |
| 12 | Archiving | ✅ |
| 13 | Archived document retrieval | ✅ still answered, then restored |
| 14 | Permanent deletion | ✅ |
| 15 | Search entries deleted too | ✅ 0 pieces left, tutor no longer finds it |
| 16 | Storage monitoring | ✅ file count went down by one |
| 17 | AI quota exhaustion | ✅ friendly "no answers left" message |
| 18 | AI service unavailable | ✅ friendly message + listed in AI & Problems (temporary "broken AI" build, restored) |
| 19 | Case study creation | ✅ |
| 20 | NCP generation | ✅ |
| 21 | Quiz creation and scoring | ✅ |
| 22 | Conversation saving and resuming | ✅ after signing out and in |
| 23 | Academic planner | ✅ exam shows on planner and dashboard |
| 24 | Mobile (portrait and landscape) | ✅ |
| 25 | Unauthorized access | ✅ /admin redirects students; database refuses role change, settings, other people's records, invites; signed-out visitors get nothing |

Fixed during testing: greeting uses the whole preferred name; "New conversation" button; tutor no longer invents meanings for unknown terms or repeats old chat summaries as facts (D-052).

### Clean-up (2026-11-07) ✅
Both test students deleted (after fixing D-053). Database checked: 0 students, only the admin login, 0 chats/quizzes/case studies/care plans/planner items/usage/problems/invites. Kept by Erika's choice: Pharmacology-01 Notes (70 pieces) and P1 Self-Directed Learning Activity (12 pieces) in the shared library (no uploader name), plus 2 study sheets.

### Textbooks
- ✅ Fundamentals of Nursing (OpenStax, CC BY 4.0): 1,961 pages → 7,512 text pieces, ≈ 48 MB of the 500 MB database (whole database 64 MB). Server check: "stages of pressure injuries" → cited pp. 1081–1104; "apical pulse" → cited pp. 289–307. Search 0.3 s (2.6 s on a cold start).
- Planned (Erika's choice from the curriculum match): Pharmacology for Nurses, Maternal-Newborn Nursing, Medical-Surgical Nursing. Skipped: Clinical Nursing Skills (overlaps Fundamentals), Population Health (US system). Later: Psychiatric-Mental Health, Nutrition.

### Hidden review notes (D-062)
- "Hide from students" option on Add textbook; database rules hide such documents from students; tutor cites them as "Nurse Mira review notes" (tutor v14).
- PNLE 2026 reviewer converted: 1,765 Q&A (reading copy: 85 pages, 0.5 MB). Added hidden as "Nurse Mira review notes" from a one-question-per-page version (1,632 pieces, no page numbers) — the first import packed 2–3 questions per piece and missed reworded questions.
- Checked: a student account can't list, open or find it (documents, text pieces, duplicate check). Tutor self-test with reworded questions: EPI freezing → DPT (PNLE-style), midwife items → 1 per 5,000 formula, RA 9173 re-issuance → Sec. 24 conditions, IV 2 L/12 h at 10 gtt/ml → 28 gtt/min, furosemide → hypokalemia (textbook; overrides the reviewer's wrong key). Self-test retired.

### Next
1. Textbook import (Erika chose "before inviting"): admin-only "Add textbook (text only)" for large open textbooks (OpenStax, CC BY) — text and page numbers saved with attribution, original PDF not stored; then load 2–3 books Erika downloads.
2. Invite the first real students. Final 6-point report.
