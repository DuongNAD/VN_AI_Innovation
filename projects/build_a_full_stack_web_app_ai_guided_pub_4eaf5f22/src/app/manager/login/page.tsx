import LoginForm from '@/components/LoginForm';

export default function ManagerLoginPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <LoginForm
        portal="manager"
        title="Đăng nhập người quản lý"
        subtitle="Nhập tài khoản và mật khẩu được cấp."
        socialEnabled={false}
      />
    </main>
  );
}
