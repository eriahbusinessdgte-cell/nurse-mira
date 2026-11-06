# Decisions

Newest at the bottom. Each decision says what was decided and why, so it never has to be asked again.

| ID | Date | Decision | Why |
| --- | --- | --- | --- |
| D-001 | 2026-11-05 | Stack: Next.js on Vercel Hobby, Supabase (new project, Singapore region), GitHub. | Same tools as VA Hub; free; Singapore is close to students in the Philippines. |
| D-002 | 2026-11-05 | Nurse Mira stays free for students (no fees, ads or paid tutoring). | Required by Vercel Hobby's non-commercial rule. Revisit hosting if this changes. |
| D-003 | 2026-11-05 | AI: Groq free tier (main), Cloudflare Workers AI free (backup). Not Gemini's free tier. | Groq and Cloudflare state they don't train on customer data; Gemini's free tier uses content to improve Google products. |
| D-004 | 2026-11-05 | Each student gets 10 full AI tutor answers per day by default (changeable in Settings). | Keeps the shared free AI limit fair across students. |
| D-005 | 2026-11-05 | The admin sees accounts, counts and activity, but not the contents of students' private work. | Protects student privacy and patient-related material. |
| D-006 | 2026-11-05 | Students are invited with one-time setup links that the admin copies and sends; resets work the same way. | No paid or limited email service needed; admin never sees passwords. |
| D-007 | 2026-11-05 | Shared reviewers become available to the AI immediately; originals are not downloadable by others unless the admin enables it per document. | Combines the master brief (automatic sharing) with the supplement (controlled file access). |
| D-008 | 2026-11-05 | Microphone only in the AI Tutor, not in Case Study or NCP builders. | Chrome sends speech to Google; avoids spoken patient details leaving the app. |
| D-009 | 2026-11-05 | Design: E-Skool-style layout; blue and white with warm yellow accents; original artwork only; no Refer a friend / PTA sections. | Erika's chosen sample, adapted to Nurse Mira. |
| D-010 | 2026-11-05 | Greeting: "Good morning / afternoon / evening, Nurse (first name)" by device time; "Nurse" added automatically and never doubled. Admin greeting has no "Nurse". | Erika's request. |
| D-011 | 2026-11-05 | Repository is public. | Vercel Hobby needs it to deploy commits made by Claude. Code only — no secrets or student data are ever committed. |
| D-013 | 2026-11-06 | Claude manages the database through the Supabase connector (no copying SQL by hand). Project `nurse-mira`, ref `kkvsyepuguwyzndpjqea`, region ap-southeast-1 (Singapore), free plan. | Erika never edits database code; changes are versioned in `supabase/migrations/`. |
| D-014 | 2026-11-06 | The Supabase URL and publishable key are written in `src/lib/supabase/config.ts`; Vercel needs no environment variables for Phase 2. | Both values are public by design; Row Level Security protects the data. Fewer setup steps for Erika. |
| D-015 | 2026-11-06 | Admin actions that need the Supabase secret key (inviting students, reset links) will run as Supabase Edge Functions, where the key is provided automatically. | The secret key never has to be copied anywhere by hand. |
| D-016 | 2026-11-06 | Public sign-up is blocked inside the database: only the bootstrap admin email (eriah.businessdgte@gmail.com) or emails on the server-only `pending_invites` list (added by the invite tool, valid 1 hour, used once) can get an account. (First version checked app_metadata, which Supabase applies too late — fixed same day.) | Works even if someone calls the sign-up API directly. |
| D-012 | 2026-11-06 | Fonts bundled with the app (`geist` package) instead of loading from Google Fonts. | Works offline and avoids an outside request on every build. |
| D-017 | 2026-11-06 | Setup and reset links are one-time links that expire after 1 hour (Supabase default). The admin can make a new one at any time from the student's page. | Keeps links safe if a message is forwarded. |
| D-018 | 2026-11-06 | Admin can permanently delete a student (typing their email to confirm). Turning the account off remains the recommended option for real students. | Erika asked for a way to remove test accounts. |
| D-019 | 2026-11-06 | Unbuilt features appear in the menu with a "Soon" label instead of linking to empty pages. | Shows what is coming without broken-looking pages. |
| D-020 | 2026-11-06 | Files are read in the student's browser (pdf.js, mammoth, JSZip, tesseract.js); the server stores text pieces and builds the search index in small batches. | Free, no outside service, works within Supabase's 2-second CPU limit; indexing can resume after interruptions. |
| D-021 | 2026-11-06 | The admin sees the title and size of students' private documents (for storage management) but cannot open the file or read its text. | Balances storage management with student privacy (D-005). |
| D-022 | 2026-11-06 | An exact duplicate of a shared reviewer is blocked at upload; the admin also sees a duplicates list. | Saves the 1 GB free storage. |
| D-023 | 2026-11-06 | "Keep text only": archived shared documents can drop their original file but keep their text for the AI. | Frees storage without losing knowledge. |
| D-024 | 2026-11-06 | When a student is deleted, their private documents are deleted too; shared reviewers they uploaded stay. | Shared knowledge benefits everyone; private material leaves with the student. |
| D-025 | 2026-11-06 | Supabase's leaked-password check is a paid feature and stays off; passwords must be at least 8 characters. | Free-first rule. |
