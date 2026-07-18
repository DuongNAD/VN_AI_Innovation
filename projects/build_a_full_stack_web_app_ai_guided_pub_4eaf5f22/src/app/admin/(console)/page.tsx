import AdminConsole from '@/components/AdminConsole';

export default function AdminPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Cổng quản trị</p>
        <h1 className="text-2xl font-bold text-slate-800">
          Admin — duyệt đơn, phê duyệt &amp; kích hoạt phiên bản
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Yêu cầu đăng nhập tài khoản admin. Toàn quyền staff: duyệt hồ sơ công dân, phê duyệt
          change request và cài đặt hệ thống. (Manager cũng duyệt được đơn; chỉ admin kích hoạt
          phiên bản biểu mẫu.)
        </p>
      </div>
      <AdminConsole role="admin" />
    </main>
  );
}
