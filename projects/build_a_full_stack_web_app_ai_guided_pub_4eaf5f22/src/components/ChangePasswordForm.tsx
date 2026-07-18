'use client';

import { FormEvent, useState } from 'react';

type Notice = {
  type: 'success' | 'error';
  message: string;
} | null;

// Mirrors the server rule in `isStrongEnoughPassword` so the user gets instant
// feedback; the server remains the source of truth.
function passwordStrengthError(pw: string): string | null {
  if (pw.length < 8) return 'Mật khẩu mới tối thiểu 8 ký tự.';
  if (pw.length > 128) return 'Mật khẩu mới tối đa 128 ký tự.';
  if (!/[A-Za-z]/.test(pw)) return 'Mật khẩu mới phải chứa ít nhất một chữ cái.';
  if (!/[0-9]/.test(pw)) return 'Mật khẩu mới phải chứa ít nhất một chữ số.';
  return null;
}

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const strengthError = next.length > 0 ? passwordStrengthError(next) : null;
  const mismatch = confirm.length > 0 && next !== confirm;
  const sameAsCurrent = next.length > 0 && next === current;

  const canSubmit =
    !busy &&
    current.length > 0 &&
    next.length > 0 &&
    confirm.length > 0 &&
    !strengthError &&
    !mismatch &&
    !sameAsCurrent;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const strength = passwordStrengthError(next);
    if (strength) {
      setNotice({ type: 'error', message: strength });
      return;
    }
    if (next !== confirm) {
      setNotice({ type: 'error', message: 'Xác nhận mật khẩu không khớp.' });
      return;
    }
    if (next === current) {
      setNotice({ type: 'error', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
      }
      setNotice({ type: 'success', message: result.message || 'Đã đổi mật khẩu thành công.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Không thể đổi mật khẩu. Vui lòng thử lại.',
      });
    } finally {
      setBusy(false);
    }
  }

  const inputType = show ? 'text' : 'password';

  return (
    <form className="profile-form password-form" onSubmit={submit}>
      <div className="profile-form__heading">
        <div className="profile-avatar" aria-hidden="true">
          🔑
        </div>
        <div>
          <h2>Đổi mật khẩu</h2>
          <p>Đặt mật khẩu mới cho tài khoản. Các thiết bị khác sẽ được đăng xuất.</p>
        </div>
      </div>

      <div className="profile-grid">
        <label className="profile-field profile-field--wide">
          <span>
            Mật khẩu hiện tại <strong aria-hidden="true">*</strong>
          </span>
          <input
            name="currentPassword"
            type={inputType}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>

        <label className="profile-field">
          <span>
            Mật khẩu mới <strong aria-hidden="true">*</strong>
          </span>
          <input
            name="newPassword"
            type={inputType}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            required
          />
          {strengthError ? (
            <small className="font-medium text-red-600">{strengthError}</small>
          ) : sameAsCurrent ? (
            <small className="font-medium text-red-600">
              Mật khẩu mới phải khác mật khẩu hiện tại.
            </small>
          ) : (
            <small>Tối thiểu 8 ký tự, gồm cả chữ và số.</small>
          )}
        </label>

        <label className="profile-field">
          <span>
            Xác nhận mật khẩu mới <strong aria-hidden="true">*</strong>
          </span>
          <input
            name="confirmPassword"
            type={inputType}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            required
          />
          {mismatch && (
            <small className="font-medium text-red-600">Mật khẩu xác nhận không khớp.</small>
          )}
        </label>
      </div>

      <label className="password-toggle">
        <input
          type="checkbox"
          checked={show}
          onChange={(event) => setShow(event.target.checked)}
        />
        <span>Hiển thị mật khẩu</span>
      </label>

      {notice ? (
        <div
          className={`profile-notice profile-notice--${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="profile-actions">
        <button
          className="profile-button profile-button--primary"
          type="submit"
          disabled={!canSubmit}
        >
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
}
