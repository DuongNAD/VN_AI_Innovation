/**
 * Dashboard route — the application's home page.
 *
 * This is a React Server Component (no 'use client'): it runs on the server,
 * loads the initial student list directly from the database via Prisma, and
 * hands that data to the interactive {@link StudentDashboard} client component
 * that owns search, summary metrics, and the CRUD dialogs.
 *
 * `dynamic = 'force-dynamic'` opts the route out of static rendering and
 * caching so every request reflects the current database state (students are
 * mutable and change through the CRUD flows). After any mutation the client
 * calls `router.refresh()`, which re-runs this component to fetch fresh rows.
 *
 * SCOPE NOTE (access control & result size): per the project design
 * (design.md), this system deliberately introduces NO authentication,
 * authorization, or pagination. It is a local, single-user school dashboard
 * over a SQLite file whose entire purpose is to "view all metrics while
 * narrowing the list", which requires the full dataset on the client for the
 * summary metrics and client-side search. Authentication/authorization and any
 * request-size or rate limits are therefore expected to be enforced at the
 * deployment / reverse-proxy layer, consistent with the API route handlers,
 * rather than added here (which would contradict the stated design and the
 * matching contract locked by the route tests). The unbounded `findMany`
 * mirrors the collection endpoint (`GET /api/students`) by design.
 */
import { prisma } from '@/lib/prisma';
import StudentDashboard from '@/components/StudentDashboard';

// Always render on demand against live data — never serve a cached snapshot.
export const dynamic = 'force-dynamic';

/**
 * Load all students (newest first) and render the dashboard shell around the
 * interactive client component.
 *
 * The rows returned by Prisma carry `Date` objects for `createdAt`/`updatedAt`,
 * which are not serializable across the server/client boundary as the client's
 * `Student` type expects (it uses ISO strings). We therefore map each row to a
 * plain object, converting those two fields with `toISOString()`.
 *
 * The empty-database case is intentionally NOT special-cased here: an empty
 * list is passed straight through, and {@link StudentDashboard} renders its own
 * empty state.
 */
export default async function Page() {
  const rows = await prisma.student.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Convert to plain, fully serializable objects matching the client `Student`
  // type (Date -> ISO string for createdAt/updatedAt).
  const students = rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    fullName: row.fullName,
    email: row.email,
    major: row.major,
    gpa: row.gpa,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 animate-fade-in-up">
        <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Student Profile System
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300 sm:text-lg">
          View, search, and manage student records — add, edit, and remove
          profiles from a single polished dashboard.
        </p>
      </header>

      <StudentDashboard initialStudents={students} />
    </main>
  );
}