import Link from 'next/link';

export default function ManagerRegisterPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Cổng người quản lý</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Không tự đăng ký tài khoản quản lý</h1>
        <p className="mt-3 text-sm text-slate-600">
          Tài khoản cán bộ quản lý do quản trị viên cấp trong mục{' '}
          <span className="font-semibold">Quản lý tài khoản</span> của hệ thống. Nếu bạn cần quyền
          truy cập, hãy liên hệ quản trị viên.
        </p>
        <Link
          href="/manager/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Về trang đăng nhập
        </Link>
      </div>
    </main>
  );
}
