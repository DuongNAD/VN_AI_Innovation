import LoginForm from '@/components/LoginForm';

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <LoginForm
        portal="admin"
        title="Đăng nhập quản trị viên"
        subtitle="Chỉ tài khoản vai trò admin — quản lý tài khoản và cài đặt kỹ thuật hệ thống."
        socialEnabled={false}
      />
    </main>
  );
}
