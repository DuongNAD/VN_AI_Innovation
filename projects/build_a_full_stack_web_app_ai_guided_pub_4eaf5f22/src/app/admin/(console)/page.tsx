import AdminConsole from '@/components/AdminConsole';

export default function AdminPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Cổng quản trị</p>
        <h1 className="text-2xl font-bold text-slate-800">
          Admin — quản lý tài khoản &amp; kỹ thuật hệ thống
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Yêu cầu đăng nhập tài khoản admin. Cấp/quản lý tài khoản, cài đặt hệ thống và phê duyệt
          phiên bản biểu mẫu — hồ sơ công dân do cán bộ quản lý xét duyệt tại cổng người quản lý.
        </p>
      </div>
      <AdminConsole role="admin" />
    </main>
  );
}
