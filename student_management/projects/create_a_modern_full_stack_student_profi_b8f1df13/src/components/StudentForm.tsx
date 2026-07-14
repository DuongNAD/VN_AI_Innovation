'use client';

/**
 * StudentForm — the accessible add/edit modal form.
 *
 * A single component backs both flows: "add" when `initial` is null and "edit"
 * when `initial` is a student. It owns the field values, per-field validation
 * timing, and the hand-written modal a11y behaviors (aria-modal dialog, focus
 * trap, focus move on open, focus restore on close, Escape/overlay close) that
 * `next build` cannot prove — those behaviors are locked by
 * StudentForm.dom.test.tsx.
 *
 * A11Y (shared field/control conventions applied to EVERY field): the <form> is
 * marked `noValidate` so the aria-based messages are the single source of truth
 * and native constraint tooltips never compete with them; each field has a
 * <label htmlFor> bound to a matching input id and rendered above the control;
 * controls inherit a font-size >= 1rem and a >= 48px touch target; a field with
 * an error sets `aria-invalid='true'` and `aria-describedby` pointing at the
 * <p id> that renders its message below the input.
 *
 * VALIDATION TIMING: a field is validated on blur with its matching validator
 * from validation.ts; typing into a field clears that field's error. On submit
 * the whole input is validated with `validateStudent` — if anything is invalid,
 * every field is marked touched, all errors are shown, focus moves to the first
 * invalid field, and `onSubmit` is NOT called; otherwise `onSubmit(values)`
 * fires. Incoming `serverErrors` (e.g. a 409 duplicate studentId) are merged
 * onto the same per-field error slots.
 */
import { useEffect, useRef, useState } from 'react';

import {
  COMMON_MAJORS,
  validateStudent,
  validateStudentId,
  validateFullName,
  validateEmail,
  validateMajor,
  validateGpa,
  type FieldErrors,
  type FieldName,
  type StudentInput,
} from '@/lib/validation';

/**
 * The client-side shape of a student. Mirrors the type used by
 * StudentDashboard: `createdAt`/`updatedAt` are ISO strings because the server
 * component serializes the Prisma `DateTime` values before passing them down.
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

/** Field values are all held as strings while editing (GPA included). */
type FormValues = Record<FieldName, string>;

/** The fields in render/submit order, used for focus and mark-all-touched. */
const FIELD_ORDER: FieldName[] = [
  'studentId',
  'fullName',
  'email',
  'major',
  'gpa',
];

/** Per-field single-value validators, keyed by field name for blur checks. */
const VALIDATORS: Record<FieldName, (v: string) => string | null> = {
  studentId: validateStudentId,
  fullName: validateFullName,
  email: validateEmail,
  major: validateMajor,
  gpa: validateGpa,
};

/** Stable id prefix so labels, inputs, and error nodes line up predictably. */
const ID_PREFIX = 'student-form';
/** The id shared by the Major input's `list` and its <datalist>. */
const DATALIST_ID = `${ID_PREFIX}-majors`;
/** The id the dialog's aria-labelledby points at (the heading). */
const TITLE_ID = `${ID_PREFIX}-title`;

/**
 * The focusable-element selector used by the focus trap. Deliberately a
 * stable, explicit set (matching DeleteDialog) so the .dom test can drive Tab
 * reliably: enabled links, buttons, inputs, selects, textareas, and any
 * element with a non-negative tabindex.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Build blank values for the "add" flow. */
function blankValues(): FormValues {
  return { studentId: '', fullName: '', email: '', major: '', gpa: '' };
}

/** Seed values from an existing student for the "edit" flow. */
function valuesFromStudent(student: Student): FormValues {
  return {
    studentId: student.studentId,
    fullName: student.fullName,
    email: student.email,
    major: student.major,
    gpa: String(student.gpa),
  };
}

export default function StudentForm({
  generalError = null,
  open,
  initial,
  serverErrors,
  submitting,
  onSubmit,
  onClose,
}: {
  /** Non-field failure (network/5xx) shown INSIDE the dialog — the
   *  page banner would be hidden behind the modal overlay. */
  generalError?: string | null;
  open: boolean;
  initial: Student | null;
  serverErrors: FieldErrors;
  submitting: boolean;
  onSubmit: (values: StudentInput) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() =>
    initial ? valuesFromStudent(initial) : blankValues(),
  );
  // `touched` records which fields the user has interacted with (or that a
  // submit marked). Errors are only ever populated intentionally, so display
  // reads straight from `errors`; `touched` backs the mark-all-on-submit step.
  const [touched, setTouched] = useState<Set<FieldName>>(() => new Set());
  const [errors, setErrors] = useState<FieldErrors>({});

  // The dialog panel (focus-trap scope) and per-field inputs (for focusing the
  // first field on open and the first invalid field on a blocked submit).
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRefs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>(
    {},
  );

  // Capture the element that had focus when the dialog mounted, and restore
  // focus to it on unmount (i.e. on close) — the required focus-restore.
  useEffect(() => {
    // Keyed on `open` (not empty deps): the component stays mounted with
    // open=false, so a mount-time capture would grab <body> and the
    // unmount-only cleanup would never run on close.
    if (!open) {
      return;
    }
    const trigger = document.activeElement as HTMLElement | null;
    return () => {
      trigger?.focus?.();
    };
  }, [open]);

  // Reset values/touched/errors whenever the dialog opens or its target
  // changes, so "add" starts blank and "edit" seeds from the student.
  useEffect(() => {
    setValues(initial ? valuesFromStudent(initial) : blankValues());
    setTouched(new Set());
    setErrors({});
  }, [open, initial]);

  // Merge incoming server-side field errors (e.g. a 409 duplicate studentId)
  // onto the same per-field slots, and mark those fields touched.
  useEffect(() => {
    if (serverErrors && Object.keys(serverErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...serverErrors }));
      setTouched((prev) => {
        const next = new Set(prev);
        for (const key of Object.keys(serverErrors) as FieldName[]) {
          next.add(key);
        }
        return next;
      });
    }
  }, [serverErrors]);

  // Move focus to the first field when the dialog opens.
  useEffect(() => {
    inputRefs.current.studentId?.focus();
  }, [open]);

  /** Update a field's value and clear any error currently shown for it. */
  function handleChange(field: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!(field in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  /** Validate a single field on blur, setting or clearing its error. */
  function handleBlur(field: FieldName) {
    setTouched((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
    const message = VALIDATORS[field](values[field]);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  /**
   * Validate everything on submit. If anything is invalid, show all errors,
   * mark every field touched, focus the first invalid field, and do NOT call
   * onSubmit. Otherwise pass the current values through (GPA stays a string;
   * the server/parseGpa converts it).
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allErrors = validateStudent(values);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setTouched(new Set(FIELD_ORDER));
      const firstInvalid = FIELD_ORDER.find((field) => allErrors[field]);
      if (firstInvalid) {
        inputRefs.current[firstInvalid]?.focus();
      }
      return;
    }
    onSubmit({ ...values });
  }

  /** Focus-trap + Escape handling scoped to the dialog panel. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // Wrap at both ends so Tab/Shift+Tab never leaves the panel.
    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Close when the overlay backdrop itself (not the panel) is clicked. */
  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  if (!open) {
    return null;
  }

  const submitLabel = initial ? 'Save changes' : 'Add student';
  const heading = initial ? 'Edit student' : 'Add student';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onKeyDown={handleKeyDown}
        className="card w-full max-w-lg animate-fade-in-up p-6 sm:p-8"
      >
        <h2
          id={TITLE_ID}
          className="font-display text-2xl font-bold text-white"
        >
          {heading}
        </h2>

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          {FIELD_ORDER.map((field) => {
            const id = `${ID_PREFIX}-${field}`;
            const errorId = `${id}-error`;
            const error = errors[field];
            const invalid = Boolean(error);

            // Field-specific presentation deltas.
            const label =
              field === 'studentId'
                ? 'Student ID'
                : field === 'fullName'
                  ? 'Full Name'
                  : field === 'email'
                    ? 'Email'
                    : field === 'major'
                      ? 'Major'
                      : 'GPA';

            const isGpa = field === 'gpa';
            const isMajor = field === 'major';

            return (
              <div key={field}>
                <label
                  htmlFor={id}
                  className="mb-1.5 block text-sm font-medium text-slate-200"
                >
                  {label}
                </label>
                <input
                  id={id}
                  ref={(node) => {
                    inputRefs.current[field] = node;
                  }}
                  name={field}
                  value={values[field]}
                  onChange={(event) => handleChange(field, event.target.value)}
                  onBlur={() => handleBlur(field)}
                  aria-invalid={invalid ? 'true' : undefined}
                  aria-describedby={invalid ? errorId : undefined}
                  type={isGpa ? 'number' : field === 'email' ? 'email' : 'text'}
                  inputMode={isGpa ? 'decimal' : undefined}
                  step={isGpa ? '0.1' : undefined}
                  min={isGpa ? '0' : undefined}
                  max={isGpa ? '4' : undefined}
                  list={isMajor ? DATALIST_ID : undefined}
                  className={`min-h-[48px] w-full rounded-xl border bg-white/5 px-4 py-3 text-base text-slate-100 placeholder:text-slate-400 backdrop-blur transition focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    invalid
                      ? 'border-rose-500/60'
                      : 'border-white/10 focus-visible:border-emerald-400/50'
                  }`}
                />
                {isMajor && (
                  <datalist id={DATALIST_ID}>
                    {COMMON_MAJORS.map((major) => (
                      <option key={major} value={major} />
                    ))}
                  </datalist>
                )}
                {invalid && (
                  <p id={errorId} className="mt-1.5 text-sm text-rose-300">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
          {generalError && (
            <p role="alert" className="text-sm text-rose-300">
              {generalError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-brand-500 px-5 py-3 font-medium text-white shadow-lg transition hover:from-emerald-400 hover:to-brand-400 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}