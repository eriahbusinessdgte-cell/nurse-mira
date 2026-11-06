# Project Status

_Last updated: 6 November 2026 (Philippine time)_

**Current phase:** Phase 2 — Setup

## Done

- Phase 1 plan approved (Nurse Mira – Phase 1 Plan doc).
- Design direction chosen: E-Skool-style layout, blue and white with a warm yellow accent, greeting "Good morning, Nurse (name)".
- GitHub repository `nurse-mira` created; Claude has access.
- Supabase connected to Claude; project `nurse-mira` created in Singapore (free plan).
- Database foundation: accounts and roles, invite-only sign-up, curriculum with the 26 subjects, student subject choices (any year), privacy rules.
- App: login page, signed-in front door, Phase 2 admin and student homes with the time-of-day greeting, sign out, loading indicators.

## Tested

| Test | Result |
| --- | --- |
| Stranger cannot create an account | ✅ |
| Invited student gets a student profile | ✅ |
| Student sees only their own profile and subjects | ✅ |
| Student cannot make themselves admin or change another student | ✅ |
| Irregular student can pick 2nd- and 3rd-year subjects | ✅ (test 6, database level) |
| Student cannot edit the curriculum; signed-out visitors see nothing | ✅ |
| 26 subjects loaded, correct years and semesters | ✅ |
| Greeting: morning/afternoon/evening, "Nurse" added once, admin without "Nurse" | ✅ |
| App type-check, lint and production build | ✅ |

## Next

1. Vercel project connected to the repository (Erika — SETUP_GUIDE step 3).
2. Erika creates her admin login (SETUP_GUIDE step 4) and signs in on the live site (test 1).

## Known problems

None.
