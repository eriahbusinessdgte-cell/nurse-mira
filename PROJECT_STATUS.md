# Project Status

_Last updated: 6 November 2026 (Philippine time)_

**Current phase:** Phase 3 — Foundation (Phase 2 complete ✅)

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
| Live site at nurse-mira.vercel.app; signed-out visitors go to the sign-in page | ✅ |
| Test 1: administrator login on the live site (eriah.businessdgte@gmail.com has the admin role) | ✅ |

## Next (Phase 3)

Design system and sidebar, admin Students page (invite links, edit, deactivate/reactivate, reset links),
Curriculum page, 5-step student onboarding, student dashboard, global search.

## Known problems

- Vercel's first build failed because a test file was included in the app's type check. Fixed the same day; tests now run separately (`npm test`).
