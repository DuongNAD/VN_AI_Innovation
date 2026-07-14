'use client';

/**
 * DeleteDialog — a confirmation modal that guards student deletion.
 *
 * A destructive action deserves an explicit, focused confirmation step, so this
 * dialog uses the ARIA `alertdialog` role (a dialog that interrupts the user to
 * confirm a consequential choice). It names the student in both the heading and
 * the body so there is no ambiguity about which record is about to be removed.
 *
 * A11Y — this component implements the shared MODAL conventions by hand, since
 * `aria-modal` alone neither traps focus nor manages focus movement:
 *   - `role="alertdialog"` with `aria-modal="true"` and `aria-labelledby` /
 *     `aria-describedby` bound to the heading and body text;
 *   - on open, focus moves to the Cancel button (the safe, non-destructive
 *     default) rather than to Delete;
 *   - Tab / Shift+Tab are trapped within the dialog, wrapping at BOTH ends,
 *     computed from a stable focusable-element query (the same selector set
 *     StudentForm uses) so the behavior is testable;
 *   - Escape and an overlay (backdrop) click both close via `onCancel`;
 *   - on close (unmount) focus is restored to the element that opened the
 *     dialog.
 *
 * The two action buttons apply the shared control conventions: a 48px minimum
 * touch target and a visible :focus-visible ring (the global fallback in
 * globals.css plus the local ring utilities here). The parent mounts this
 * component only while open, so the on-open focus move and on-close restore run
 * cleanly against the triggering element.
 */
import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * The client-side shape of a student. Mirrors the type used across the
 * dashboard (dates as ISO strings). Only `fullName` and `studentId` are shown
 * here, but the full shape is declared for a consistent prop contract.
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
 * Stable selector set for the focus trap. Identical to the one StudentForm
 * uses so the .dom test can drive Tab / Shift+Tab reliably. Disabled controls
 * (e.g. the Delete button while a request is in flight) are excluded so focus
 * never lands on an unusable target.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Ids linking the dialog to its heading and body text via aria-labelledby /
// aria-describedby.
const TITLE_ID = 'delete-dialog-title';
const BODY_ID = 'delete-dialog-body';

/**
 * Render the deletion confirmation modal. Returns `null` (renders nothing) when
 * the dialog is not open or has no target student.
 */
export default function DeleteDialog({
  generalError = null,
  open,
  student,
  submitting,
  onConfirm,
  onCancel,
}: {
  /** Non-field failure shown inside the dialog (page banner is covered). */
  generalError?: string | null;
  open: boolean;
  student: Student | null;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // The dialog panel, used to scope the focusable-element query for the trap.
  const panelRef = useRef<HTMLDivElement>(null);
  // The Cancel button, which receives focus on open (the safe default).
  const cancelRef = useRef<HTMLButtonElement>(null);

  // On open: remember the element that triggered the dialog so focus can be
  // restored to it on close, then move focus to the Cancel button (NOT Delete —
  // the safe, non-destructive default). The cleanup (which runs on unmount,
  // i.e. when the parent stops rendering the dialog) restores focus to the
  // trigger. Empty deps: this runs once per mount, BEFORE the early return so
  // the hook order is stable.
  useEffect(() => {
    // Keyed on `open` (not empty deps): the component stays mounted with
    // open=false and early-returns null, so a mount-once effect would run
    // while the dialog is closed — Cancel would never receive focus on a
    // real open and the restore cleanup would never fire on close.
    if (!open) {
      return;
    }
    const trigger = document.activeElement as HTMLElement | null;

    // Move focus to the safe default (Cancel), never to the destructive Delete.
    cancelRef.current?.focus();

    return () => {
      // Restore focus only if the trigger is still connected to the document
      // and can actually receive focus.
      if (
        trigger &&
        typeof trigger.focus === 'function' &&
        trigger.isConnected
      ) {
        trigger.focus();
      }
    };
  }, [open]);

  // Nothing to confirm: render no DOM at all. Declared AFTER the hooks so the
  // hook order never changes between renders.
  if (!open || !student) {
    return null;
  }

  /** Collect the currently focusable elements inside the panel, in DOM order. */
  function getFocusable(): HTMLElement[] {
    const panel = panelRef.current;
    if (!panel) {
      return [];
    }
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  /**
   * Key handling for the dialog: Escape closes via `onCancel`, and Tab /
   * Shift+Tab are trapped so focus wraps at both ends of the focusable set.
   * When there is no focusable target at all, Tab is prevented outright so
   * focus can never leave the dialog.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusable();
    if (focusable.length === 0) {
      // No focusable target: keep focus from leaving the dialog entirely.
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      // Reverse: wrap from the first focusable element back to the last.
      if (active === first || !panelRef.current?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Forward: wrap from the last focusable element back to the first.
      if (active === last || !panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * A click directly on the backdrop (not on the panel) closes the dialog. The
   * target/currentTarget check ensures clicks bubbling up from inside the panel
   * do not trigger a close. This is wired to onMouseDown so a Testing Library
   * `user.click` on the backdrop fires it.
   */
  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }

  return (
    // Backdrop overlay: dims the page and closes the dialog on an outside press.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={handleOverlayClick}
    >
      {/* Dialog panel. onKeyDown drives the Escape-close and focus-trap logic. */}
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={BODY_ID}
        onKeyDown={handleKeyDown}
        className="card animate-fade-in-up w-full max-w-md p-6"
      >
        <div className="flex items-start gap-4">
          {/* Warning icon reinforces the destructive nature of the action. */}
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h2
              id={TITLE_ID}
              className="font-display text-lg font-semibold text-white"
            >
              Delete {student.fullName}?
            </h2>
            <p id={BODY_ID} className="mt-2 text-sm text-slate-300">
              This will permanently remove{' '}
              <span className="font-medium text-slate-100">
                {student.fullName}
              </span>{' '}
              ({student.studentId}) from the student list. This action cannot be
              undone.
            </p>
          </div>
        </div>

        {/* Actions: Cancel (safe default, focused on open) then destructive
            Delete. Both meet the 48px touch minimum and carry focus rings. */}
        {generalError && (
          <p role="alert" className="text-sm text-rose-300">
            {generalError}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-3 font-medium text-white shadow-lg transition hover:from-rose-400 hover:to-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}