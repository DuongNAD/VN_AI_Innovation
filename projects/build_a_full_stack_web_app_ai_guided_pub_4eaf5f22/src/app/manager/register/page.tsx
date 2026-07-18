import RegisterForm from '@/components/RegisterForm';

export default function ManagerRegisterPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <RegisterForm
        portal="manager"
        title="Đăng ký quản lý"
        subtitle="Tạo tài khoản quản lý để xem và giám sát thủ tục."
      />
    </main>
  );
}
