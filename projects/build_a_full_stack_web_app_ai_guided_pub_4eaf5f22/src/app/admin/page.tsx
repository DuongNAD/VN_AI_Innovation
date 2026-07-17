import AdminConsole from '@/components/AdminConsole';

export default function AdminPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">
        Quản trị — demo, bảo vệ bằng mã X-Admin-Token dùng chung
      </h1>
      <AdminConsole />
    </main>
  );
}