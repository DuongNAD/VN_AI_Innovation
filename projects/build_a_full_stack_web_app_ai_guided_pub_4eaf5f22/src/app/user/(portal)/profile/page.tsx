import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import ProfileForm from '@/components/ProfileForm';
import { prisma } from '@/lib/db';
import { getAuthUserFromCookies } from '@/lib/login-auth';

export default async function ProfilePage() {
  const user = await getAuthUserFromCookies();
  if (!user || user.role !== 'user') {
    redirect('/user/login');
  }

  // Social-login / VNeID-only accounts have no password to change; hide the form.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  const hasPassword = Boolean(account?.passwordHash);

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <Link href="/user" className="catalog-back-link">
          <span aria-hidden="true">←</span>
          Trang chủ
        </Link>
        <div className="profile-title">
          <p>Hồ sơ công dân</p>
          <h1>Chỉnh sửa thông tin cá nhân</h1>
          <span>Bạn có thể cập nhật thông tin bất cứ lúc nào.</span>
        </div>
        <ProfileForm user={user} />
        {hasPassword ? <ChangePasswordForm /> : null}
      </div>
    </main>
  );
}
