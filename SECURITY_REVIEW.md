# Nurse Mira — Security review (Phase 7, 2026-11-06)

## Checked and passing
- **Every table has row-level security turned on** (17 app tables + problems log).
- **Admin can't read students' private work:** signed in as the admin, the database returned 0 of the Test Student's chats, messages, quizzes, quiz results, case studies, care plans, planner items and private documents. Students have fewer rights than the admin, so one student can't see another's either (same owner-only rules).
- **Problems log and AI usage counts:** a student account sees 0 problems and is refused the usage counts ("admin only").
- **Files:** the storage bucket is private. Each person uploads only into their own folder; reading needs your own folder, or a shared, downloadable, active library document (the admin can open shared documents).
- **Secrets:** no service keys, Groq/Cloudflare keys or tokens in the app code or the built website (only the public "publishable" key, which is meant to be public). AI keys live only in Supabase's secret store.
- **Server functions:** every AI and admin function checks who is signed in and whether they're active; backup, library tools for other people's files, and settings are admin only. Calls are only accepted from nurse-mira.vercel.app (and local testing).
- **Patient privacy:** case studies and care plans require the de-identification confirmation, and identifiers (names, hospital numbers, phone numbers, etc.) are blocked before anything is sent to the AI.
- **Backups:** locked with the admin's own password (AES-256); the app has no screen for reading them.

## Advisor notes reviewed and accepted
- `pending_invites` has no policies — on purpose; only the server reads it.
- `ping()` can be called without signing in — on purpose (daily keep-alive); it only deletes old logs.
- Functions signed-in users can call (`is_admin`, `is_active_user`, `student_daily_limit`, `find_shared_duplicate`, `log_app_event`, `admin_storage_stats`, `ai_provider_counts`) each check permissions inside and return nothing private.
- "Leaked password protection" needs the paid Pro plan; not used. Passwords must be at least 8 characters.

## Performance
- Added 8 missing indexes on links between tables. "Unused index" notes are expected with so little data yet.
