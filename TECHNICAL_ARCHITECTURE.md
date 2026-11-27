# Technical Architecture

## Overview

```
Student / Admin browser
  │  Next.js pages (Vercel)            ← reads files (PDF, DOCX, PPTX, images) in the browser,
  │                                       mic + read-aloud via the browser's Web Speech API
  ▼
Next.js server routes (Vercel)         ← checks login and role on every request,
  │                                       never trusts the browser alone
  ├──► Supabase Postgres               ← all records; Row Level Security on every private table
  │      └─ pgvector                   ← searchable library pieces (384-number "embeddings")
  ├──► Supabase Storage                ← original files (private bucket; signed links only)
  ├──► Supabase Edge Function          ← gte-small embeddings, runs inside Supabase (no outside AI)
  ├──► Groq API (main AI)              ← tutor answers; free tier, no training on data
  └──► Cloudflare Workers AI (backup)  ← used when Groq is down or out of daily quota
```

## Key rules

- **Secrets** live only in Vercel Environment Variables and a git-ignored `.env.local`. The Supabase
  service key is used only on the server, never in browser code.
- **Privacy is enforced in the database** (Row Level Security), not just by hiding buttons.
- **Uploaded documents are untrusted.** Their text is passed to the AI as quoted reference material,
  never as instructions. The system prompt tells the model to ignore instructions inside sources.
- **Patient privacy.** Case study and NCP text is scanned for likely identifiers before it is sent to an AI;
  the student must also confirm de-identification. No microphone in those builders.
- **AI can fail safely.** Every AI call has a timeout, a daily-usage counter and the backup provider.
  If both are unavailable, students see a friendly notice and everything else keeps working.
- **Retrieval.** Library pieces are ranked by similarity, then boosted by authority level
  (official guidance > textbook > school material > review centre > student upload) and by
  active-semester status. Archived material stays searchable at lower priority.
- **Deletion.** Permanently deleting a document removes the file, its text pieces and embeddings, and its record
  in one database transaction plus a storage delete.
- **Portability.** Plain Postgres + files. The admin backup download exports every table as JSON/CSV
  and the library's original files.

## Oral Revalida and the upgraded tutor (D-070, D-071)

- `revalida` Edge Function: `start` (find/create the case + revision, create a new session — no AI) and `batch` (5 questions per AI answer → repeat checks → save). Repeat checks run in code against all earlier questions for that student + case: normalised text, word overlap, concept + skill, self-containment, gte-small meaning similarity via `revalida_nearest()` (service-only SQL function), and similarity + same category + same skill. Bounded retries; honest shortfall note. A short lock (`generating_until`) stops two tabs generating at once.
- Screens: `/revalida` (start + history), `/revalida/[id]` (flashcards, summary), `/revalida/review?filter=bookmarked|difficult` (across sessions). Card state is written straight to the database (column-limited grants) as the student taps.
- `tutor` Edge Function: newest-first conversation history within a character budget; optional attached-file text; answer room 1,800 / 3,200 / 6,000 tokens for questions / tasks / long tasks; requests too big for Groq's per-minute limit go straight to Cloudflare.

## Free-tier limits (checked November 2026)

| Service | Limit |
| --- | --- |
| Supabase | 500 MB database, 1 GB files, 50 MB per file, 5 GB bandwidth/month, pauses after 1 week of no activity, no automatic backups |
| Vercel Hobby | Personal, non-commercial use only |
| Groq | Per-model daily request/token limits shared by the whole app (exact values in the Groq console) |
| Cloudflare Workers AI | 10,000 neurons per day |

## Case Study Checker (D-072)

- `case-check` Edge Function: `start` (no AI) splits the text into sections at headings (`split.ts`: markdown, CHAPTER/PART/UNIT, lettered/roman headings, known section names; long sections split at paragraphs) and groups them into parts of ~6,000 characters; detects CHN vs hospital format. `step` runs one AI answer: first an overview of the whole paper (digest of every section), then one part at a time. Busy lock (`working_until`), daily limit, saved after every step.
- Safety in code: a revised section is not used if it is <70% or >160% (+400 chars) of the original, or if `factGuard` finds a dropped number, a changed marital-status/setting word, or an added/changed body side or limb. Look-alike characters are normalised; an echoed title is removed; redacted details are restored in order.
- Screens: `/case-studies/check` (import + history), `/case-studies/check/[id]` (progress, word-level highlighted changes via `src/lib/case/diff.ts`, keep-original per section, summary, Word download, copy). Saving is a server action that inserts a new `case_studies` row.
