# Research Brief: Student Profile Management System

## Original Request

> Create a modern, full-stack Student Profile Management System web app. Stack: Next.js (App Router), TailwindCSS, and a local SQLite database (using Prisma or similar) or just a simple mock storage if preferred. Features: 1. Dashboard with a list of students. 2. Form to Add a new student (Student ID, Full Name, Email, Major, GPA). 3. Edit student info. 4. Delete student. Make the UI very beautiful, modern and responsive.

## Key Finding (read first)

**The requested application already exists in the codebase, fully implemented, and appears functionally complete against every stated requirement.** Every file enumerated in `plan.md` is present with complete content, plus a generated Prisma migration (`prisma/migrations/20260714060056_init/migration.sql`, timestamped today, 2026-07-14). No net-new feature file is required to satisfy the literal request. The architect should treat this as a **verification-and-intent** task, not a greenfield build. The dominant open question is what the user wants *now*, given the deliverable is already present (see Open Questions).

I cannot run code; I have not built, installed, or tested anything. All statements about behavior below are read from source, not from execution.

## Requirements

Functional requirements derived from the request, each mapped to its existing implementation:

1. **Full-stack app on Next.js App Router + TailwindCSS + local SQLite via Prisma.**
   - App Router entry: `src/app/layout.tsx`, `src/app/page.tsx` (RSC loading data via Prisma).
   - Tailwind: `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css` (dark glassmorphism theme, `brand` navy ramp, Inter/Outfit fonts, `fade-in-up` animation).
   - Prisma/SQLite: `prisma/schema.prisma` (SQLite datasource `url = "file:./dev.db"`, hardcoded literal — not `env()`), shared client `src/lib/prisma.ts`, seed `prisma/seed.ts`.
   - `Student` model fields: `id`, `studentId` (`@unique`), `fullName`, `email`, `major`, `gpa` (Float), `createdAt`, `updatedAt` (`prisma/schema.prisma`).

2. **Dashboard with a list of students.**
   - `src/app/page.tsx` → `src/components/StudentDashboard.tsx` renders a responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) of `src/components/StudentCard.tsx`, newest first, with empty-state and no-match states.
   - Extras beyond the bare request: `src/components/SummaryCards.tsx` (total students, average GPA to 2 decimals, top major with first-seen tie-break) and `src/components/SearchFilter.tsx` (client-side search over name/major/ID). **Scope note:** summary metrics always reflect the full dataset; search filters only the visible grid.

3. **Add-student form (Student ID, Full Name, Email, Major, GPA).**
   - `src/components/StudentForm.tsx` (accessible modal) → `POST /api/students` (`src/app/api/students/route.ts`). Exactly the five requested fields.

4. **Edit student info.**
   - Same `StudentForm` seeded with the student → `PATCH /api/students/[id]` (`src/app/api/students/[id]/route.ts`).

5. **Delete student.**
   - `src/components/DeleteDialog.tsx` (confirmation `alertdialog`) → `DELETE /api/students/[id]`.

6. **Beautiful, modern, responsive UI.**
   - Dark navy gradient background, frosted-glass `.card` surface (`globals.css`), GPA color thresholds (≥3.5 emerald, ≥2.5 amber, else rose — `StudentCard.tsx`), staggered card entrance animation, responsive 1/2/3-column layouts, `min-h-[48px]` touch targets, `focus-visible` rings, hand-written modal a11y (focus trap wrapping both ends, Escape/overlay close, focus restore, validate-on-blur, clear-on-input).

## Constraints

These are locked design decisions already encoded in the codebase (`plan.md` and source). Any change here would break existing tests or the stated contract:

- **No `.env` file.** Prisma datasource URL is a hardcoded literal `"file:./dev.db"` (`prisma/schema.prisma`). Do not create, read, parse, or echo any `.env` or secret. `.gitignore` ignores `.env*` defensively.
- **Single source of validation truth.** `src/lib/validation.ts` is imported by both `StudentForm.tsx` and both API routes so client/server rules cannot drift. Its **exact English messages are asserted verbatim** in `src/lib/validation.test.ts` and must remain unchanged:
  - `Student ID is required` / `Student ID must be 32 characters or fewer` (max 32)
  - `Full name is required` / `Full name must be 100 characters or fewer` (max 100)
  - `Email is required` / `Enter a valid email address` (pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$`)
  - `Major is required` / `Major must be 80 characters or fewer` (max 80)
  - `GPA is required` / `GPA must be a plain decimal number (e.g. 3.75)` / `GPA must be between 0.0 and 4.0` (range [0.0, 4.0], inclusive; plain-decimal pattern `^-?\d+(\.\d+)?$` rejects `0x3`, `0b11`, `1e0`, `abc` before any `Number()` coercion).
- **HTTP status contract** (locked by `src/app/api/students/route.test.ts` against a `vi.mock`'d Prisma client — no DB):
  - `GET /api/students` → 200.
  - `POST` → 201 (valid; text fields trimmed, GPA coerced to number), 400 (field errors), 400 `{error:'Invalid JSON'}`, 409 `{errors:{studentId:'A student with this Student ID already exists'}}` (Prisma P2002), 500 (other).
  - `PATCH /api/students/[id]` → 200, 400 (fields/JSON), 404 (non-numeric/non-positive id via strict `/^\d+$/` + safe-integer guard, or P2025 missing), 409 (P2002).
  - `DELETE /api/students/[id]` → 204 (empty body), 404 (bad id or P2025), 500 (other).
  - Invalid ids `abc`, `0`, `-1`, `0x1`, `1e1`, `1.0` must all resolve to 404 without touching the DB.
- **No authentication, authorization, or pagination** — deliberate. Single-user local dashboard; access control and body-size limits are a deploy/reverse-proxy concern. `findMany` is intentionally unbounded (the full dataset is needed client-side for summary metrics + search). Route tests intentionally do **not** assert 401/403.
- **String semantics are ASCII-pragmatic:** length caps use `String.length` (UTF-16 code units, not graphemes); search uses `String.prototype.toLowerCase` (no locale/Unicode casefold).
- **TypeScript strict**; `@/*` path alias → `./src/*`, mirrored in both `tsconfig.json` and `vitest.config.ts` (the alias match is required for `vi.mock('@/lib/prisma')` to intercept).
- **Client `Student` type** (`id:number`; `studentId/fullName/email/major:string`; `gpa:number`; `createdAt/updatedAt`: ISO string) is declared locally in each component that needs it (existing convention, no shared model module); `page.tsx` converts Prisma `Date` → `toISOString()` at the server/client boundary.
- **Do not author `next-env.d.ts`** (Next-generated) or hand-write SQL migrations.

## Dependencies

- **Runtime:** `next@^14`, `react@^18`, `react-dom@^18`, `@prisma/client@^5`, `lucide-react@^0.400`.
- **Dev/tooling:** `prisma@^5`, `typescript@^5`, Tailwind/PostCSS/Autoprefixer, ESLint + `eslint-config-next`, `vitest@^1`, `tsx@^4`, `jsdom@^24`, `@testing-library/{react,user-event,jest-dom}`.
- **External at build time:** `next/font/google` fetches Inter and Outfit; a build in an offline/network-restricted environment may fail here.
- **Required setup steps before the app runs** (from `README.md`; none are yet performed in this workspace): `npm install` → `npx prisma generate` → `npx prisma db push` (creates `prisma/dev.db`) → optional `npm run db:seed` → `npm run dev`. Verification commands: `npm run test` (Vitest, 3 surfaces), `npm run build` (`prisma generate && next build`), `npm run lint`.

## Risks

- **Nothing has been verified.** `node_modules` and `prisma/dev.db` are absent (both correctly gitignored). The claim that tests/build/lint pass is *unproven* — I cannot and did not run them. The architect/executor should run `npm run test`, `npm run build`, and `npm run lint` before declaring done. Do not report these as passing without executing them.
- **Migration vs. documented DB flow mismatch.** A committed migration exists at `prisma/migrations/20260714060056_init/`, but `README.md` and `plan.md` prescribe `prisma db push` for schema setup — `db push` does not consume/require the migrations folder (`prisma migrate deploy` would). This is harmless (both yield the same schema/unique index on `studentId`) but is an inconsistency worth resolving so the DB-setup story is singular.
- **Build-time font fetch** (Inter/Outfit via Google) can fail without network access; the whole `next build` depends on it.
- **Unbounded `findMany`** in `page.tsx` and `GET /api/students` will not scale past small datasets — accepted by design for a local single-user dashboard, but a genuine limitation if the deployment target changes.
- **No auth by design** — acceptable only under the stated single-user/local assumption; a networked deployment would expose full CRUD to anyone reaching the port.

## Open Questions

1. **Intent — the primary question.** The requested system already exists and is complete. Does the user want to (a) verify the existing build passes tests/lint/build, (b) modify or extend it (e.g. sorting, pagination, per-column filtering, auth, CSV export), (c) rebuild/regenerate it fresh, or (d) something else? The bare request gives no signal that anything new is needed. The architect should not schedule a redundant re-implementation without confirming intent.
2. **DB setup canonicalization:** should the project standardize on `prisma db push` (drop/ignore the committed migration) or on migration-based flow (`prisma migrate deploy`)? Pick one to remove the mismatch noted under Risks.
3. **Deployment target:** is this staying a local single-user tool (justifying the no-auth / no-pagination / unbounded-query decisions), or is a networked/multi-user deployment intended (which would reopen auth, pagination, and result-size constraints)?