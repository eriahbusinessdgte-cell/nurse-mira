# Development Plan

Each phase ends with a checkpoint: Erika tries it and approves before the next phase starts.
Test numbers refer to the 25 required tests in the master brief (Part 12).

| Phase | What gets built | Tests | Erika's tasks |
| --- | --- | --- | --- |
| 1. Plan | Product and technical plan | — | Approve the plan ✅ |
| 2. Setup | Repository, Supabase (Singapore), Vercel, project documents, live login page | 1 | Create repository ✅, Supabase project, connect Vercel, add keys |
| 3. Foundation | Design system, navigation, admin Students and Curriculum, invite/reset links, 5-step onboarding, student dashboard, irregular subject selection, global search | 1–6, 24, 25 | Invite a test student and try onboarding |
| 4. Library & storage | Upload (shared/private), text extraction, suggestions, indexing, duplicates, archive/restore/delete, storage dashboard, backup download | 7–16 | Provide 2–3 reviewers she is allowed to share |
| 5. AI Tutor | Groq + Cloudflare backup, Tea/Clinical modes, cited answers, saved conversations, Continue Studying, voice, limit and outage handling | 9, 10, 17, 18, 22 | Create Groq and Cloudflare accounts |
| 6. Study tools | Case Study Builder, NCP Builder, Review Center, quizzes and exams, flashcards, planner | 19–21, 23 | Try each with a de-identified sample case |
| 7. Admin & reliability | Activity and error logs, AI usage page, settings, retention rules, security review, speed | 25 + permission checks | Review admin pages |
| 8. Launch | Full re-test, fixes, final setup | All 25 | Send invite links to the first students |

## First version vs later

Later (not in the first version): real email invitations, more than one admin, natural real-time voice (paid),
PNLE-focused tutor, document version history, sharing case studies with classmates, phone notifications,
licensed question banks.
