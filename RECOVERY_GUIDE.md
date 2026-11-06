# Nurse Mira — Recovery Guide (plain English)

## Making a backup (about once a week)
1. Sign in as the admin and open **Backups** in the menu.
2. Type your **backup password** twice (at least 10 characters). Use the same one every time and keep it in a password manager or written down at home. **If it is lost, the backup can't be opened by anyone.**
3. Press **Make and download a backup**. A file named like `nurse-mira-backup-2026-11-06.nmb` goes to your Downloads.
4. Put a copy somewhere other than your computer too (for example your Google Drive). Keep the last few.

The Overview page reminds you when the last backup is more than 7 days old.

**What's inside:** students, subjects and topics, the library's text, tutor chats, study sheets, quizzes and results, case studies, care plans, planners and settings.
**Not inside:** the original uploaded files (PDFs, photos, Word files) — their text is. Keep your own copies of important originals.

## Checking a backup (safe — changes nothing)
1. Backups → **Check or restore a backup**.
2. Choose the `.nmb` file and type its password, then press **Check this backup**.
3. You'll see how many records are in the file and how many are missing from the app now. "Nothing needs restoring" means everything is still there.

## Putting back lost records
After a check that shows missing records, press **Put back the … missing record(s)**.
- Only missing records come back. Nothing that exists now is changed or removed.
- Library documents rebuild their search automatically (if one shows "Restored from a backup", press **Retry** in the library).
- If a student's sign-in account was deleted, their records can't come back — invite them again.
- A restored document whose original file is gone keeps its text (the tutor still uses it) but can't be downloaded.

## If the whole app stops working
- **"Project paused":** the app pings itself daily so this shouldn't happen. If it does, sign in to supabase.com, open the *nurse-mira* project and press **Restore project**. Data is kept.
- **The website is down:** check vercel.com → nurse-mira → Deployments; the newest one should say *Ready*. Ask Claude for help with anything else.
- **Everything was lost:** a new Supabase project would need to be set up from the saved setup files (the `supabase/migrations` folder in GitHub) and then the backup restored. Ask Claude to walk you through it — you will need your backup file and its password.
