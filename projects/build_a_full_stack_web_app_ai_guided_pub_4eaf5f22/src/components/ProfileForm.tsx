'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { CitizenIdScanData } from '@/lib/citizen-id';
import type { AuthUser } from '@/lib/login-auth';
import CitizenIdCapture from './CitizenIdCapture';

type Props = {
  user: AuthUser;
};

type Notice = {
  type: 'success' | 'error';
  message: string;
} | null;

type ProfileFields = {
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  citizenId: string;
  gender: string;
  placeOfBirth: string;
  idIssuedAt: string;
  idExpiresAt: string;
};

export default function ProfileForm({ user }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [fields, setFields] = useState<ProfileFields>({
    displayName: user.displayName,
    email: user.email ?? '',
    phone: user.phone ?? '',
    dateOfBirth: user.dateOfBirth ?? '',
    address: user.address ?? '',
    citizenId: user.citizenId ?? '',
    gender: user.gender ?? '',
    placeOfBirth: user.placeOfBirth ?? '',
    idIssuedAt: user.idIssuedAt ?? '',
    idExpiresAt: user.idExpiresAt ?? '',
  });

  const today = new Date().toISOString().slice(0, 10);

  function updateField<K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function applyScan(data: CitizenIdScanData) {
    setFields((current) => ({
      ...current,
      ...(data.displayName ? { displayName: data.displayName } : {}),
      ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.citizenId ? { citizenId: data.citizenId } : {}),
      ...(data.gender ? { gender: data.gender } : {}),
      ...(data.placeOfBirth ? { placeOfBirth: data.placeOfBirth } : {}),
      ...(data.idIssuedAt ? { idIssuedAt: data.idIssuedAt } : {}),
      ...(data.idExpiresAt ? { idExpiresAt: data.idExpiresAt } : {}),
    }));
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
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
      <CitizenIdCapture onDetected={applyScan} />

      <div className="profile-form__heading">
        <div className="profile-avatar" aria-hidden="true">
          {fields.displayName.trim().charAt(0) || 'N'}
        </div>
        <div>
          <h2>Thông tin tài khoản</h2>
          <p>Thông tin quét từ căn cước phải được bạn kiểm tra trước khi lưu.</p>
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
            value={fields.displayName}
            onChange={(event) => updateField('displayName', event.target.value)}
            autoComplete="name"
            maxLength={120}
            minLength={2}
            required
          />
        </label>

        <label className="profile-field">
          <span>Số định danh cá nhân</span>
          <input
            name="citizenId"
            value={fields.citizenId}
            onChange={(event) =>
              updateField('citizenId', event.target.value.replace(/\D/g, '').slice(0, 12))
            }
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{12}"
            placeholder="12 chữ số trên căn cước"
          />
          <small>Thông tin này chưa được xác thực với cơ sở dữ liệu quốc gia.</small>
        </label>

        <label className="profile-field">
          <span>Ngày sinh</span>
          <input
            name="dateOfBirth"
            type="date"
            value={fields.dateOfBirth}
            onChange={(event) => updateField('dateOfBirth', event.target.value)}
            autoComplete="bday"
            min="1900-01-01"
            max={today}
          />
        </label>

        <label className="profile-field">
          <span>Giới tính</span>
          <select
            name="gender"
            value={fields.gender}
            onChange={(event) => updateField('gender', event.target.value)}
          >
            <option value="">Chưa cung cấp</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
            <option value="Khác">Khác</option>
          </select>
        </label>

        <label className="profile-field">
          <span>Ngày cấp</span>
          <input
            name="idIssuedAt"
            type="date"
            value={fields.idIssuedAt}
            onChange={(event) => updateField('idIssuedAt', event.target.value)}
            min="2000-01-01"
            max={today}
          />
        </label>

        <label className="profile-field">
          <span>Ngày hết hạn</span>
          <input
            name="idExpiresAt"
            type="date"
            value={fields.idExpiresAt}
            onChange={(event) => updateField('idExpiresAt', event.target.value)}
            min="2000-01-01"
          />
        </label>

        <label className="profile-field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={fields.email}
            onChange={(event) => updateField('email', event.target.value)}
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
            value={fields.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            autoComplete="tel"
            maxLength={20}
            placeholder="0901 234 567"
          />
        </label>

        <label className="profile-field profile-field--wide">
          <span>Nơi đăng ký khai sinh</span>
          <input
            name="placeOfBirth"
            value={fields.placeOfBirth}
            onChange={(event) => updateField('placeOfBirth', event.target.value)}
            maxLength={300}
            placeholder="Phường/xã, tỉnh/thành phố"
          />
        </label>

        <label className="profile-field profile-field--wide">
          <span>Nơi cư trú/Địa chỉ liên hệ</span>
          <textarea
            name="address"
            value={fields.address}
            onChange={(event) => updateField('address', event.target.value)}
            autoComplete="street-address"
            maxLength={300}
            rows={3}
            placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
          />
        </label>
      </div>

      <div className="profile-privacy">
        <span aria-hidden="true">🔒</span>
        Ảnh căn cước được mã hóa khi lưu. Dữ liệu chỉ dùng để chuẩn bị hồ sơ và không được
        xem là đã xác thực danh tính.
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
          {busy ? 'Đang lưu…' : 'Kiểm tra và lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}
