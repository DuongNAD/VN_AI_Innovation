'use client';

/**
 * StudentCard — a single student rendered as a frosted-glass card with edit and
 * delete actions.
 *
 * Presentation: the shared `.card` surface (defined in globals.css) provides the
 * rounded-2xl border, translucent fill, and backdrop blur; this component adds a
 * hover scale/shadow transition on top. The student's full name uses the display
 * font, the student id is shown as a muted badge, the email truncates to avoid
 * overflow, the major is a chip, and the GPA carries a colored indicator whose
 * hue encodes the value (see {@link gpaTheme}).
 *
 * Accessibility: the two icon-only buttons apply the shared control conventions
 * — a minimum 48px touch target and a visible :focus-visible ring (the global
 * fallback in globals.css plus the local ring utilities here) — and each carries
 * a descriptive `aria-label` naming the student, since the icon alone conveys no
 * text to assistive technology.
 */
import { Pencil, Trash2 } from 'lucide-react';

/**
 * The client-side shape of a student. `createdAt`/`updatedAt` are ISO strings
 * (serialized from the Prisma `DateTime` values on the server); they are not
 * displayed here but are part of the shared type passed through the dashboard.
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

/** Explicit GPA color thresholds (inclusive lower bounds). */
const GPA_EMERALD_THRESHOLD = 3.5;
const GPA_AMBER_THRESHOLD = 2.5;

/**
 * Tailwind classes for the GPA indicator, chosen from the explicit thresholds:
 * gpa >= 3.5 -> emerald, gpa >= 2.5 -> amber, otherwise rose. A dot color and a
 * matching translucent pill keep the mapping legible at a glance.
 */
function gpaTheme(gpa: number): { dot: string; pill: string } {
  if (gpa >= GPA_EMERALD_THRESHOLD) {
    return {
      dot: 'bg-emerald-400',
      pill: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    };
  }
  if (gpa >= GPA_AMBER_THRESHOLD) {
    return {
      dot: 'bg-amber-400',
      pill: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    };
  }
  return {
    dot: 'bg-rose-400',
    pill: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  };
}

/**
 * Render one student card. `onEdit`/`onDelete` receive the whole `student` so
 * the parent dashboard can open the matching dialog.
 */
export default function StudentCard({
  student,
  onEdit,
  onDelete,
}: {
  student: Student;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
}) {
  const gpa = gpaTheme(student.gpa);

  return (
    <article className="card flex h-full flex-col gap-4 p-5 transition duration-200 hover:scale-[1.02] hover:shadow-xl">
      {/* Header: identity on the left, action buttons on the right. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-lg font-semibold text-white">
            {student.fullName}
          </h3>
          <span className="mt-1 inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-400">
            {student.studentId}
          </span>
        </div>

        {/* Icon-only actions: min 48px targets, focus-visible rings, and
            student-naming aria-labels since the icon carries no text. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(student)}
            aria-label={`Edit ${student.fullName}`}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(student)}
            aria-label={`Delete ${student.fullName}`}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-slate-300 transition hover:bg-rose-500/20 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Email truncates to keep long addresses from breaking the layout. */}
      <p className="truncate text-sm text-slate-300" title={student.email}>
        {student.email}
      </p>

      {/* Footer: major chip and the colored GPA indicator. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
          <span className="truncate">{student.major}</span>
        </span>

        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${gpa.pill}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${gpa.dot}`}
            aria-hidden="true"
          />
          <span className="font-display">GPA {student.gpa.toFixed(2)}</span>
        </span>
      </div>
    </article>
  );
}