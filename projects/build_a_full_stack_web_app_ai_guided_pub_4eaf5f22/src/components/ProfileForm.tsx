'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { AuthUser } from '@/lib/login-auth';

type Props = {
  user: AuthUser;
};

type Notice = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function ProfileForm({ user }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      displayName: String(form.get('displayName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      dateOfBirth: String(form.get('dateOfBirth') ?? ''),
      address: String(form.get('address') ?? ''),
    };

    try {
      const response = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message || 'Không thể lưu thông tin. Vui lòng thử lại.');
      }
      setNotice({ type: 'success', message: result.message || 'Đã lưu thông tin cá nhân.' });
      router.refresh();
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Không thể lưu thông tin. Vui lòng thử lại.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="profile-form__heading">
        <div className="profile-avatar" aria-hidden="true">
          {user.displayName.trim().charAt(0) || 'N'}
        </div>
        <div>
          <h2>Thông tin tài khoản</h2>
          <p>Các thông tin này giúp điền hồ sơ nhanh và chính xác hơn.</p>
        </div>
      </div>

      <div className="profile-grid">
        <label className="profile-field">
          <span>Tên đăng nhập</span>
          <input value={user.username} disabled />
          <small>Tên đăng nhập không thể thay đổi.</small>
        </label>

        <label className="profile-field">
          <span>
            Họ và tên <strong aria-hidden="true">*</strong>
          </span>
          <input
            name="displayName"
            defaultValue={user.displayName}
            autoComplete="name"
            maxLength={120}
            minLength={2}
            required
          />
        </label>

        <label className="profile-field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            defaultValue={user.email ?? ''}
            autoComplete="email"
            maxLength={254}
            placeholder="vidu@email.com"
          />
        </label>

        <label className="profile-field">
          <span>Số điện thoại</span>
          <input
            name="phone"
            type="tel"
            defaultValue={user.phone ?? ''}
            autoComplete="tel"
            maxLength={20}
            placeholder="0901 234 567"
          />
        </label>

        <label className="profile-field">
          <span>Ngày sinh</span>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={user.dateOfBirth ?? ''}
            autoComplete="bday"
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>

        <label className="profile-field profile-field--wide">
          <span>Địa chỉ liên hệ</span>
          <textarea
            name="address"
            defaultValue={user.address ?? ''}
            autoComplete="street-address"
            maxLength={300}
            rows={3}
            placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
          />
        </label>
      </div>

      <div className="profile-privacy">
        <span aria-hidden="true">🔒</span>
        Thông tin cá nhân chỉ được dùng để hỗ trợ chuẩn bị hồ sơ của bạn.
      </div>

      {notice ? (
        <div
          className={`profile-notice profile-notice--${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="profile-actions">
        <Link href="/user" className="profile-button profile-button--secondary">
          Quay lại
        </Link>
        <button className="profile-button profile-button--primary" type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}
