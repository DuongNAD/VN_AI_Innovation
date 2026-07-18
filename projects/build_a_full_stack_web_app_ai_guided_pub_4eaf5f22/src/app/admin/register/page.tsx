import RegisterForm from '@/components/RegisterForm';

export default function AdminRegisterPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <RegisterForm
        portal="admin"
        title="Đăng ký quản trị"
        subtitle="Tạo tài khoản quản trị viên."
      />
    </main>
  );
}
