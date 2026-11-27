# Troubleshooting

| Problem | Likely cause | What to do |
| --- | --- | --- |
| The site says it can't reach the database, after a quiet week or a semester break | Supabase's free plan paused the project after 1 week with no activity. No data is lost. | Open supabase.com → the nurse-mira project → click **Restore project**. Wait a few minutes, then reload Nurse Mira. |
| The AI Tutor says it is resting / unavailable | The free daily AI limit was reached, or the AI service is down | Wait — limits reset daily. Everything else in Nurse Mira still works. Admin → Overview shows AI status. |
| A student can't sign in | Account deactivated, or setup link expired | Admin → Students → check status; use **Send new setup link**. |
| An upload stays "Processing failed" | Scanned or password-protected file, or text couldn't be read | Open the document in My Library and click **Retry**; if it fails again, save it as a normal PDF and upload again. |
| Storage warning at 70% / 80% / 90% | The 1 GB free file storage is filling up | Admin → Storage: remove duplicates, archive old semesters with "keep text only", or delete unneeded files. |
| Oral Revalida made fewer questions than asked | Nurse Mira refuses questions that repeat earlier sessions for the same case, or the day's AI answers ran out | Read the note on the session. Add more case details (labs, medications, care plan) for more to ask about, or come back after midnight and press Try again. |
| Oral Revalida says "Some progress isn't saved yet" | Internet dropped while practising | Press **Try again** next to the message; the session itself is already saved. |
| AI Tutor only read part of an attached file | Free AI limits: about the first 6 pages are read | Attach a shorter file or paste the part you need. |
| Vercel shows "Deployment blocked" | Repository was made private | Keep the repository public (decision D-011). |
