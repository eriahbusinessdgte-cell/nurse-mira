# Nurse Mira

**Your Personal Nursing School Companion** — a private, AI-powered study app for Filipino nursing students.

Product owner and administrator: Erika Angel Perez.

## What it does

- AI Tutor that does the task you ask (writes, creates reviewers and questions, revises, summarizes attached files, explains), with sources from the shared library and saved chats
- Oral Revalida Practice: case-based clinical-instructor questions as flashcards, saved sessions, no repeated questions across sessions
- Review Center, Quizzes & Exams, Flashcards
- Nursing Case Study Builder, Nursing Care Plan (NCP) Builder, Family Care Plan Maker and Drug Study Maker
- Case Study Checker: import your own case study for light, explained revisions (every change shown with its reason, contradictions flagged for you), saved as a new copy
- Academic Planner
- Admin area for students, curriculum, the shared library and storage

## How it is built (plain language)

| Part | Service | Cost |
| --- | --- | --- |
| Website | Next.js app hosted on Vercel (Hobby plan) | Free |
| Database, logins, file storage | Supabase (Singapore region) | Free |
| AI Tutor | Groq (main) with Cloudflare Workers AI (backup) | Free, with daily limits |
| Code | GitHub — `eriahbusinessdgte-cell/nurse-mira` | Free |

Details: [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md).

## Project documents

| Document | What it covers |
| --- | --- |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | What is done and what is left |
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | The 8 phases and their checkpoints |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | How the parts fit together |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables and privacy rules |
| [DECISIONS.md](DECISIONS.md) | Decisions made and why |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | One-time account setup |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common problems and fixes |

## Running it (for developers)

```bash
npm install
npm run dev     # local preview at http://localhost:3000
npm run build   # production build check
```

Secrets (API keys) are never stored in this repository. They live in Vercel's Environment Variables settings
and in a local `.env.local` file that git ignores.
