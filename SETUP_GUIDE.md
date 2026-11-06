# Setup Guide

One-time setup steps Erika does herself. Claude guides each one in the chat, one at a time.
**Never paste passwords or secret keys into the chat.**

| Step | Task | Status |
| --- | --- | --- |
| 1 | Create the GitHub repository `nurse-mira` (public, with README) and give the Claude GitHub app access | ✅ Done |
| 2 | Create the Supabase project `nurse-mira` in the Singapore region | Next |
| 3 | Import the repository into Vercel | Later |
| 4 | Copy Supabase keys into Vercel → Settings → Environment Variables | Later |
| 5 | Sign in as administrator on the live site | Later |
| 6 | Create a free Groq account and API key (Phase 5) | Later |
| 7 | Create a free Cloudflare account and API token (Phase 5) | Later |

## Environment variables (names only — values never go in this file)

| Name | Where it comes from | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys | No (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys | **Yes — server only** |
| `GROQ_API_KEY` | Groq console → API Keys | **Yes** |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard | **Yes** (token) |
