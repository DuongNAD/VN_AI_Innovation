/**
 * Component behavior tests for {@link StudentForm}.
 *
 * These run under Vitest's jsdom environment (the file name ends in
 * `.dom.test.tsx`, which vitest.config routes to jsdom) and lock the
 * hand-written accessibility behaviors that a `next build` type-check and
 * bundle cannot prove at runtime: on-open focus placement, validate-on-blur,
 * clear-on-input, the Tab / Shift+Tab focus trap wrapping at BOTH ends, Escape
 * to close, focus restore to the triggering element, and submit being blocked
 * while the form is invalid.
 *
 * jest-dom matchers (toHaveFocus, toHaveAttribute, ...) are registered by the
 * shared setup file referenced from vitest.config.ts.
 *
 * FOCUS-RESTORE HARNESS: the component captures whatever element was focused
 * when it opened and returns focus there on close. To exercise that, the form
 * is rendered inside a small wrapper that owns the `open` state and exposes a
 * real trigger <button>. Each test clicks that trigger to open the dialog,
 * which (a) leaves the trigger as `document.activeElement` at open time — the
 * element the form will restore to — and (b) mirrors how the real dashboard
 * opens the form.
 */
import { useState } from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import StudentForm from './StudentForm';
import type { StudentInput } from '@/lib/validation';

/**
 * The exact selector set the component uses to compute focusable controls for
 * its trap. Mirrored here so the trap tests can identify the first and last
 * focusable elements the same way the component does, rather than assuming a
 * particular control by name.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** A fully valid set of field values (GPA stays a string, as the form holds it). */
const VALID: StudentInput = {
  studentId: 'S1001',
  fullName: 'Ada Lovelace',
  email: 'a@b.co',
  major: 'Computer Science',
  gpa: '3.9',
};

/**
 * Wrapper owning the `open` state and a real trigger button. Clicking the
 * trigger opens the form and leaves the trigger focused, so the form can
 * capture it as the focus-restore target. On close the wrapper flips `open`
 * to false (unmounting the form so its focus-restore effect runs) and records
 * the `onClose` spy, mirroring how the real dashboard behaves.
 */
function Harness({
  onSubmit,
  onClose,
}: {
  onSubmit: (values: StudentInput) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open form
      </button>
      <StudentForm
        open={open}
        initial={null}
        serverErrors={{}}
        submitting={false}
        onSubmit={onSubmit}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
    </>
  );
}

/**
 * Render the harness and open the form through its trigger button, returning
 * the user-event instance, the spies, the trigger element, and the open
 * dialog. On return the form is mounted and its on-open focus effect has run.
 */
async function openForm() {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();

  render(<Harness onSubmit={onSubmit} onClose={onClose} />);

  const trigger = screen.getByRole('button', { name: /open form/i });
  await user.click(trigger);

  const dialog = await screen.findByRole('dialog');
  return { user, onSubmit, onClose, trigger, dialog };
}

/** Ordered list of focusable controls inside the dialog, per the trap's selector. */
function focusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

describe('StudentForm accessibility behaviors', () => {
  it('(1) moves focus to the first field (Student ID) on open', async () => {
    const { dialog } = await openForm();

    const studentId = within(dialog).getByLabelText(/student id/i);
    await waitFor(() => expect(studentId).toHaveFocus());
  });

  it('(2) validates the Email field on blur, showing an error wired via aria', async () => {
    const { user, dialog } = await openForm();

    const email = within(dialog).getByLabelText(/email/i);
    await user.type(email, 'nope');
    // Blur by tabbing to the next field (Email is not the last control, so this
    // does not wrap) — that fires the on-blur validation.
    await user.tab();

    expect(
      await within(dialog).findByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');

    // The error message must be wired to the field via aria-describedby.
    const describedBy = email.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = document.getElementById(describedBy as string);
    expect(errorEl).not.toBeNull();
    expect(errorEl).toHaveTextContent('Enter a valid email address');
  });

  it('(3) clears the field error on input (typing)', async () => {
    const { user, dialog } = await openForm();

    const email = within(dialog).getByLabelText(/email/i);
    await user.type(email, 'nope');
    await user.tab();

    // Precondition: the error is showing and the field is marked invalid.
    expect(
      within(dialog).getByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');

    // Typing any character clears this field's error immediately.
    await user.type(email, 'x');

    expect(
      within(dialog).queryByText('Enter a valid email address'),
    ).toBeNull();
    expect(email).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('(4) traps focus forward: Tab from the last control wraps to the first', async () => {
    const { user, dialog } = await openForm();

    const controls = focusables(dialog);
    const first = controls[0];
    const last = controls[controls.length - 1];

    last.focus();
    expect(last).toHaveFocus();

    await user.tab();
    expect(first).toHaveFocus();
  });

  it('(5) traps focus reverse: Shift+Tab from the first control wraps to the last', async () => {
    const { user, dialog } = await openForm();

    const controls = focusables(dialog);
    const first = controls[0];
    const last = controls[controls.length - 1];

    first.focus();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('(6) closes on Escape (calls onClose)', async () => {
    const { user, onClose } = await openForm();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('(7) restores focus to the trigger element on close', async () => {
    const { user, trigger } = await openForm();

    // Sanity: focus started inside the dialog, not on the trigger.
    expect(trigger).not.toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('(8) blocks submit while invalid, then submits once with the entered input', async () => {
    const { user, onSubmit, dialog } = await openForm();

    // Submitting an empty form must not call onSubmit and must surface every
    // required-field message.
    await user.click(
      within(dialog).getByRole('button', { name: /add student/i }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText('Student ID is required'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Full name is required'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Email is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Major is required')).toBeInTheDocument();
    expect(within(dialog).getByText('GPA is required')).toBeInTheDocument();

    // Fill in valid values across every field.
    await user.type(
      within(dialog).getByLabelText(/student id/i),
      VALID.studentId,
    );
    await user.type(within(dialog).getByLabelText(/full name/i), VALID.fullName);
    await user.type(within(dialog).getByLabelText(/email/i), VALID.email);
    await user.type(within(dialog).getByLabelText(/major/i), VALID.major);
    await user.type(within(dialog).getByLabelText(/gpa/i), String(VALID.gpa));

    await user.click(
      within(dialog).getByRole('button', { name: /add student/i }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(VALID);
  });
});