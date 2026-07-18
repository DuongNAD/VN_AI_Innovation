import AdminConsole from '@/components/AdminConsole';

export default function ManagerPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Cổng người quản lý</p>
        <h1 className="text-2xl font-bold text-slate-800">
          Manager — duyệt đơn &amp; quản lý biểu mẫu
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tài khoản <strong>manager</strong>: xét duyệt hồ sơ công dân (duyệt đơn theo loại),
          quản lý giấy tờ / biểu mẫu và phê duyệt &amp; kích hoạt phiên bản khi quy định thay đổi.
        </p>
      </div>
      <AdminConsole role="manager" />
    </main>
  );
}
