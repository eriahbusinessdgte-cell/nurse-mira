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
| D-012 | 2026-11-06 | Fonts bundled with the app (`geist` package) instead of loading from Google Fonts. | Works offline and avoids an outside request on every build. |
