# Setup Guide

One-time setup steps Erika does herself. Claude guides each one in the chat, one at a time.
**Never paste passwords or secret keys into the chat.**

| Step | Task | Status |
| --- | --- | --- |
| 1 | Create the GitHub repository `nurse-mira` (public, with README) and give the Claude GitHub app access | ✅ Done |
| 2 | Connect the Supabase connector to Claude (Claude then created the `nurse-mira` project in Singapore) | ✅ Done |
| 3 | Import the repository into Vercel (no environment variables needed) | ✅ Done — nurse-mira.vercel.app |
| 4 | Create the administrator login in Supabase → Authentication → Users → Add user (email eriah.businessdgte@gmail.com, own password, Auto Confirm) | ✅ Done |
| 5 | Sign in as administrator on the live site | ✅ Done |
| 6 | Create a free Groq account and add its API key as a Supabase Edge Function secret (Phase 5) | Later |
| 7 | Create a free Cloudflare account and add its token the same way (Phase 5) | Later |

## Configuration values

| Name | Where it lives | Secret? |
| --- | --- | --- |
| Supabase URL + publishable key | `src/lib/supabase/config.ts` (can be overridden by Vercel env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | No — public by design |
| Supabase secret (service role) key | Provided automatically inside Supabase Edge Functions; never copied by hand | **Yes** |
| `GROQ_API_KEY` | Supabase → Edge Functions → Secrets (entered by Erika in the dashboard) | **Yes** |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Supabase → Edge Functions → Secrets | **Yes** (token) |
