# Varindavan Boys Hostel

Next.js + TypeScript (strict) + Tailwind + Drizzle + Neon PostgreSQL.
Status: Steps 1-7 are CODE-COMPLETE but NOT yet verified against a real database/browser. See `STATUS.md` for the full list, what is pending and how to run things.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (use a separate Neon dev branch).
3. `npm run db:generate` then `npm run db:migrate` (commit the generated `server/db/migrations/` folder - it contains schema only, never data).
4. `npm run typecheck && npm test`
5. Dummy data (development only): set `SEED_ALLOWED=true` and `SEED_PARENT_PASSWORD` in `.env.local`, then `npm run seed:dummy`.
6. Warden account: `WARDEN_LOGIN_ID=... WARDEN_PASSWORD=... npm run warden:create`
7. Recovery key: `npm run recovery:hash`, put the printed value in `RECOVERY_KEY_HASH`. Keep the key itself offline.
8. `npm run dev`

## Layout
- `app/` routes (`api/admin/*`, `api/parent/*` exist in this step)
- `server/db` schema + client, `server/repos` data access (only place that talks to Drizzle)
- `server/services` business logic, `server/auth` hashing/tokens/cookies/guards
- `server/config` env + constants, `messages/en.ts` UI text, `seed/` dummy data only

## Security notes
- Passwords: argon2id. Session tokens: random, stored only as HMAC hashes.
- Warden: one DB-enforced session row; a new login replaces the old device.
- Every private API calls `requireWardenApi()` / `requireParentApi()` and, for student data, `requireStudentAccessApi()`.
- No real data, secrets or `.env` files in git.
