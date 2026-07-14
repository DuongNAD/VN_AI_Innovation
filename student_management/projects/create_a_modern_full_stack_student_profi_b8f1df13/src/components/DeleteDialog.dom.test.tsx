/**
 * Component behavior tests for {@link DeleteDialog}.
 *
 * These tests run under Vitest's jsdom environment (the file name ends in
 * `.dom.test.tsx`, which vitest.config.ts routes to jsdom) and lock the
 * hand-written a11y behaviors of the deletion confirmation modal that
 * `next build` cannot prove: on-open focus placement, Escape/overlay close,
 * the destructive confirm, the focus trap wrapping at both ends, focus restore
 * to the trigger on close, and the disabled state while a request is in flight.
 *
 * The jest-dom matchers (`toHaveFocus`, `toBeDisabled`, ...) come from the
 * shared setup file registered in vitest.config.ts.
 */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import DeleteDialog from './DeleteDialog';

/**
 * The client-side shape of a student (dates as ISO strings), matching what the
 * dashboard passes down.
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

/** A single sample student used across every case. */
const SAMPLE_STUDENT: Student = {
  id: 1,
  studentId: 'S1001',
  fullName: 'Ada Lovelace',
  email: 'ada.lovelace@example.edu',
  major: 'Computer Science',
  gpa: 3.95,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

/**
 * Render the dialog open with fresh spies. Used by the cases that do not need
 * to observe focus restore (which requires a real trigger; see {@link Harness}).
 */
function renderDialog(
  overrides: { submitting?: boolean } = {},
): { onConfirm: ReturnType<typeof vi.fn>; onCancel: ReturnType<typeof vi.fn> } {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeleteDialog
      open
      student={SAMPLE_STUDENT}
      submitting={overrides.submitting ?? false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

/**
 * A wrapper holding a real trigger button that opens the dialog, so the
 * component captures it as the focus-restore target on mount and returns focus
 * to it when the dialog closes. `onCancel` both records the spy call and closes
 * the dialog (unmounting it), mirroring how the parent dashboard behaves.
 */
function Harness({ onCancel }: { onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <DeleteDialog
        open={open}
        student={SAMPLE_STUDENT}
        submitting={false}
        onConfirm={() => {}}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      />
    </div>
  );
}

describe('DeleteDialog', () => {
  it('moves focus to the Cancel button on open', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the overlay backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    // The overlay is the panel's parent element; clicking it directly (not the
    // panel) triggers the backdrop close.
    const panel = screen.getByRole('alertdialog');
    const overlay = panel.parentElement as HTMLElement;
    await user.click(overlay);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm exactly once when Delete is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('traps focus, wrapping at both ends', async () => {
    const user = userEvent.setup();
    renderDialog();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    // From the last focusable control, Tab wraps forward to the first.
    deleteButton.focus();
    expect(deleteButton).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(cancelButton).toHaveFocus();

    // From the first focusable control, Shift+Tab wraps back to the last.
    cancelButton.focus();
    expect(cancelButton).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(deleteButton).toHaveFocus();
  });

  it('restores focus to the trigger after closing via Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);

    // Open from a real trigger so it is the active element when the dialog
    // mounts and captures the focus-restore target.
    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    // Escape closes (unmounting the dialog); focus returns to the trigger.
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it('disables the Delete button while submitting', () => {
    renderDialog({ submitting: true });
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
  });
});