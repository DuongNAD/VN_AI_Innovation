import LoginForm from '@/components/LoginForm';

export default function UserLoginPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <LoginForm
        portal="user"
        title="Đăng nhập người dùng"
        subtitle="Dùng tài khoản/mật khẩu, Google, Facebook hoặc quét QR VNeID."
        socialEnabled
      />
    </main>
  );
}
