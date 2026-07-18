import AdminConsole from '@/components/AdminConsole';

export default function ManagerPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Cổng người quản lý</p>
        <h1 className="text-2xl font-bold text-slate-800">
          Manager — duyệt đơn &amp; theo dõi hệ thống
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tài khoản vai trò <strong>manager</strong> được <strong>phê duyệt / trả lại hồ sơ công dân</strong>
          (duyệt đơn). Không được phê duyệt phiên bản biểu mẫu hay đổi cài đặt hệ thống — các thao tác
          đó dành cho admin.
        </p>
      </div>
      <AdminConsole role="manager" />
    </main>
  );
}
