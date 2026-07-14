'use client';

/**
 * StudentDashboard — the top-level client component that orchestrates the whole
 * interactive surface: summary metrics, client-side search, the card grid, and
 * the create/edit/delete dialogs.
 *
 * Data flow: the server component (`app/page.tsx`) loads the students and passes
 * them in as `initialStudents`. All CRUD mutations go through the JSON API and,
 * on success, call `router.refresh()` so the server component re-runs and feeds
 * fresh data back down as new props — there is no client-side cache to keep in
 * sync.
 *
 * SUMMARY SCOPE (per the project-wide decision): the summary metrics always
 * reflect the FULL dataset, so `SummaryCards` receives `initialStudents`
 * untouched, while the search query filters only the visible card grid.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { FieldErrors, StudentInput } from '@/lib/validation';
import SummaryCards from './SummaryCards';
import SearchFilter from './SearchFilter';
import StudentCard from './StudentCard';
import StudentForm from './StudentForm';
import DeleteDialog from './DeleteDialog';

/**
 * The client-side shape of a student. `createdAt`/`updatedAt` are ISO strings
 * because the server component serializes the Prisma `DateTime` values with
 * `toISOString()` before passing them across the server/client boundary.
 */
type Student = {
  id: number;
  studentId: string;
  fullName: string;
  email: string;
  major: string;
  gpa: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Render the interactive dashboard over the server-provided students.
 */
export default function StudentDashboard({
  initialStudents,
}: {
  initialStudents: Student[];
}) {
  const router = useRouter();

  // Client-side search text. Only the visible card grid is filtered by it.
  const [query, setQuery] = useState('');

  // Dialog state. The form is shared by "add" (editing === null) and "edit"
  // (editing === the target student); the delete dialog targets `deleting`.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);

  // Cross-cutting request state: `submitting` disables the active dialog's
  // primary action; `serverErrors` carries field-level messages from a 400/409
  // response back into the form; `actionError` surfaces any other failure.
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Derived, filtered view of the students. Matching is ASCII-pragmatic
  // (String.prototype.toLowerCase, no locale/Unicode casefold) across full
  // name, major, and student id, against the trimmed lowercased query.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return initialStudents;
    }
    return initialStudents.filter((student) => {
      return (
        student.fullName.toLowerCase().includes(q) ||
        student.major.toLowerCase().includes(q) ||
        student.studentId.toLowerCase().includes(q)
      );
    });
  }, [initialStudents, query]);

  /** Open the shared form in "add" mode with a clean slate. */
  function handleAdd() {
    setEditing(null);
    setServerErrors({});
    setActionError(null);
    setFormOpen(true);
  }

  /** Open the shared form in "edit" mode for the given student. */
  function handleEdit(student: Student) {
    setEditing(student);
    setServerErrors({});
    setActionError(null);
    setFormOpen(true);
  }

  /** Open the delete confirmation for the given student. */
  function handleDeleteRequest(student: Student) {
    setActionError(null);
    setDeleting(student);
  }

  /** Close the form and forget any pending edit target / field errors. */
  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setServerErrors({});
  }

  /** Close the delete confirmation. */
  function closeDelete() {
    setDeleting(null);
  }

  /**
   * Submit the form: POST to create, PATCH to update. On any 2xx response the
   * dialog closes, field errors clear, and the server data is re-fetched. A
   * 400/409 response feeds its `{ errors }` map back into the form as
   * `serverErrors`; any other failure shows an inline banner.
   *
   * The Content-Type header is REQUIRED — the write routes reject a bodied
   * write without it (415). `values.gpa` is already a string, so the JSON body
   * carries gpa as a JSON string (satisfying the GPA-as-string API contract),
   * and the browser adds a same-origin Origin header automatically so the
   * write guard passes.
   */
  async function handleSubmit(values: StudentInput) {
    const target = editing;
    const url = target ? `/api/students/${target.id}` : '/api/students';
    const method = target ? 'PATCH' : 'POST';

    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        closeForm();
        router.refresh();
        return;
      }

      if (response.status === 400 || response.status === 409) {
        const body = await response.json().catch(() => ({}));
        setServerErrors(
          body && typeof body === 'object' && body.errors ? body.errors : {},
        );
        return;
      }

      setActionError('Something went wrong while saving. Please try again.');
    } catch {
      setActionError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Confirm deletion of the targeted student. On success the dialog closes and
   * the server data is re-fetched; any failure shows an inline banner. DELETE
   * carries no body/Content-Type, and the browser sends a same-origin Origin so
   * the write guard passes.
   */
  async function handleConfirmDelete() {
    const target = deleting;
    if (!target) {
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/students/${target.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        closeDelete();
        router.refresh();
        return;
      }

      setActionError('Unable to delete this student. Please try again.');
    } catch {
      setActionError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Metrics always reflect the full dataset, never the search filter. */}
      <SummaryCards students={initialStudents} />

      <SearchFilter value={query} onChange={setQuery} onAdd={handleAdd} />

      {/* Inline banner for failures that are not field-level (e.g. network or
          5xx errors), which the dialogs cannot express on their own. */}
      {actionError && (
        <div
          role="alert"
          className="card border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {actionError}
        </div>
      )}

      {initialStudents.length === 0 ? (
        // Empty dataset: nothing exists yet.
        <div className="card px-6 py-16 text-center">
          <p className="font-display text-lg text-slate-100">No students yet</p>
          <p className="mt-2 text-sm text-slate-400">
            Add your first student to get started.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        // Data exists but the current search matches nothing.
        <div className="card px-6 py-16 text-center">
          <p className="font-display text-lg text-slate-100">No matches</p>
          <p className="mt-2 text-sm text-slate-400">
            No students match &ldquo;{query.trim()}&rdquo;. Try a different
            search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((student, index) => (
            <div
              key={student.id}
              className="animate-fade-in-up"
              // Stagger the entrance so cards reveal in sequence.
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <StudentCard
                student={student}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dialogs are mounted only while open so their own on-open focus move and
          on-close focus restore run cleanly against the triggering element. */}
      {formOpen && (
        <StudentForm
        generalError={actionError}
          open
          initial={editing}
          serverErrors={serverErrors}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {deleting && (
        <DeleteDialog
        generalError={actionError}
          open
          student={deleting}
          submitting={submitting}
          onConfirm={handleConfirmDelete}
          onCancel={closeDelete}
        />
      )}
    </div>
  );
}