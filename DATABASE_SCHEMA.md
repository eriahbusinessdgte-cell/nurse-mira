# Database Schema

_Planned structure. Exact columns are filled in as each phase builds its tables._

Every private row has an `owner_id`. Row Level Security lets only that owner read or change it.
The administrator manages accounts, curriculum and the shared library, but does not read students'
private work (decision D-005).

| Area | Tables | Holds | Access |
| --- | --- | --- | --- |
| Accounts | `profiles`, `student_subjects` | Name, role, year level, semester, active flag, chosen subjects (any year) | Own row; admin all |
| Curriculum | `subjects`, `topics` | 26 subjects with exact codes/titles, year, semester, topics; subjects are retired, never deleted | Everyone reads; admin edits |
| Library | `documents`, `document_chunks` | File details (title, uploader, subject, topic, year, semester, source type, authority level, permission status, size, SHA-256 fingerprint, processing status, visibility, active/archived/deleted, download allowed), text pieces with page/slide numbers and embeddings | Shared content used by AI for all; originals downloadable only if allowed; private documents owner only |
| AI Tutor | `conversations`, `messages`, `study_sessions`, `knowledge_gaps` | Chats with cited sources, session summaries, topics, weak spots, next topic | Owner only |
| Case Studies & NCPs | `case_studies`, `case_study_sections`, `care_plans` | Ordered sections, drafts, de-identification confirmation, linked NCPs with 7 parts | Owner only |
| Quizzes | `quizzes`, `questions`, `quiz_attempts`, `attempt_answers`, `flashcards` | Questions with type, answer, rationale, origin; scores over time | Owner only |
| Oral Revalida (D-070) | `revalida_cases`, `revalida_sessions`, `revalida_questions` | Case per student (saved case study or pasted/uploaded text, with revision number); every session with its own case snapshot, settings, status, position, what Nurse Mira found in the case, generation note; every question with type, category, concept, scenario, skill, difficulty, hypothetical flag, options, answer, key points, rationale, case link, normalised text and a 384-number meaning fingerprint (not readable by browsers), plus revealed/skipped/bookmarked/self-check/viewed | Owner only. Students read their rows, change only state columns, delete sessions; questions are created only by the `revalida` function |
| AI Tutor attachments (D-071) | `messages.attachment_name`, `messages.attachment_text` | Text of a file attached to a tutor message (≤ 20,000 characters) | Owner only (same as messages) |
| Planner | `planner_items` | Assignments, exams, clinical requirements, reminders | Owner only |
| Admin | `app_settings`, `ai_usage`, `activity_log`, `error_log`, `retention_rules` | Settings, daily AI usage, activity, errors, retention | Admin only |
