# Student Profile System

A modern, responsive full-stack Student Profile Management System built with Next.js 14 (App Router) + React 18 in TypeScript, TailwindCSS v3, and Prisma ORM over a local SQLite file. From a single polished dashboard you can view, add, edit, and delete student records (Student ID, Full Name, Email, Major, GPA), with client-side search and at-a-glance summary metrics. Persistence is real (Prisma/SQLite), and every validation rule lives in one shared module (`src/lib/validation.ts`) so the client form and the API routes can never drift apart.

## Prerequisites

- **Node.js 18 or newer** (Next.js 14 requires Node 18+).
- **npm** (bundled with Node).

No `.env` file is needed — see the note below.

## Setup

Run these steps in order from the project root:

```bash
npm install            # 1. Install dependencies
npx prisma generate    # 2. Generate the Prisma client
npx prisma db push     # 3. Create prisma/dev.db with the Student table
npm run db:seed        # 4. (Optional) Seed a few sample students
npm run dev            # 5. Start the dev server
```

The app is then served at **http://localhost:3000**. If you ran the optional seed step, the dashboard opens with a handful of sample students already listed, so the summary metrics and cards are populated on the first view; otherwise it starts with an empty-state prompt to add your first student.

## Commands

| Command           | What it does                                                             |
| ----------------- | ------------------------------------------------------------------------ |
| `npm run dev`     | Start the Next.js dev server (http://localhost:3000).                    |
| `npm run build`   | Run `prisma generate`, then `next build` (type-check + production build).|
| `npm run start`   | Serve the production build (after `npm run build`).                      |
| `npm run lint`    | Run `next lint` (ESLint).                                                |
| `npm run test`    | Run the full Vitest suite once (`vitest run`).                           |
| `npm run db:push` | Sync the Prisma schema to `prisma/dev.db`.                               |
| `npm run db:seed` | Seed sample students (idempotent upserts).                               |

## No `.env` required

The Prisma SQLite datasource url is a hardcoded literal (`url = "file:./dev.db"`) directly in `prisma/schema.prisma` — it is **not** an `env()` reference. No `.env` file is created, read, or parsed anywhere in this project.

## Testing

`npm run test` runs three test surfaces via Vitest:

1. **Validation logic** (`src/lib/validation.test.ts`, node env) — locks every field-validation rule and its exact message.
2. **API route handlers** (`src/app/api/students/route.test.ts`, node env) — invokes the exported `GET`/`POST`/`PATCH`/`DELETE` handlers against a **mocked** Prisma client to lock the status-code contract without a database.
3. **Component a11y behavior** (`src/components/*.dom.test.tsx`, jsdom env) — drives `StudentForm` and `DeleteDialog` with Testing Library + user-event to lock the hand-written accessibility behaviors (focus trap wrapping at both ends, Escape to close, focus restore to the trigger, validate-on-blur, clear-on-input).

The remaining presentational styling is verified at compile time by `npm run build` (type check + bundling) and `npm run lint`.

## Features

### The four CRUD flows

- **Create** — the "Add Student" button opens an accessible modal form; a valid submission `POST`s to `/api/students` and the dashboard refreshes.
- **Read** — the dashboard lists all students (newest first) as cards showing name, student ID, email, major, and a color-coded GPA.
- **Update** — a card's edit button opens the same form seeded with that student; saving `PATCH`es `/api/students/{id}`.
- **Delete** — a card's delete button opens a confirmation dialog; confirming `DELETE`s `/api/students/{id}`.

Duplicate Student IDs and invalid fields are reported inline on the form via the API's field-error responses.

### Client-side search and summary metrics

- The **search** box filters the visible card grid by full name, major, or student ID (case-insensitive).
- The **summary cards** show total students, average GPA, and the top major.

Note the deliberate scope difference: **the summary metrics always reflect the full dataset (every student), while the search box filters only the visible card list.** Narrowing the list never changes the headline numbers.

## Security & deployment model

This is a **local, single-user** tool. By design it has **no authentication, no authorization, and no pagination** — it is a school dashboard meant to run on one machine against a local SQLite file, and it deliberately loads the full student list so the summary metrics and client-side search can operate over the complete dataset.

Because the app ships no built-in access control, **access control and request-size limits are a deployment concern**, not something the app enforces on its own. Before exposing this on any shared, public, or untrusted network, put it behind an authenticating reverse proxy (or add application-level auth) and apply request-size limits there. Do not run it on a public interface as-is.