import RegisterForm from '@/components/RegisterForm';

export default function UserRegisterPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <RegisterForm
        portal="user"
        title="Đăng ký tài khoản"
        subtitle="Tạo tài khoản công dân để sử dụng dịch vụ."
      />
    </main>
  );
}
