import AdminConsole from '@/components/AdminConsole';

export default function ManagerPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Cổng người quản lý</p>
        <h1 className="text-2xl font-bold text-slate-800">
          Manager — xem danh mục &amp; yêu cầu thay đổi
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Chỉ tài khoản vai trò manager. Chỉ đọc — không phê duyệt phiên bản biểu mẫu.
        </p>
      </div>
      <AdminConsole role="manager" />
    </main>
  );
}
