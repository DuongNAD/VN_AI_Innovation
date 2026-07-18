import { redirect } from 'next/navigation';
import ProfileForm from '@/components/ProfileForm';
import { getAuthUserFromCookies } from '@/lib/login-auth';

export default async function ProfilePage() {
  const user = await getAuthUserFromCookies();
  if (!user || user.role !== 'user') {
    redirect('/user/login');
  }

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <div className="profile-title">
          <p>Hồ sơ công dân</p>
          <h1>Chỉnh sửa thông tin cá nhân</h1>
          <span>Bạn có thể cập nhật thông tin bất cứ lúc nào.</span>
        </div>
        <ProfileForm user={user} />
      </div>
    </main>
  );
}
