'use client';

/**
 * Shown when a session cookie exists but the database is temporarily unreachable.
 * Avoids forcing re-login (and lockout counters) during Docker/DB idle wake-ups.
 */
export default function DbReconnectBanner({ loginPath }: { loginPath: string }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="card max-w-md space-y-4 border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          🔌
        </div>
        <h1 className="text-xl font-bold text-amber-950">Đang kết nối lại cơ sở dữ liệu…</h1>
        <p className="text-sm text-amber-900">
          Phiên đăng nhập của bạn vẫn còn. Hệ thống tạm thời không tới được PostgreSQL (thường do
          Docker ngủ / vừa khởi động lại). Không cần đăng nhập lại.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            Thử lại ngay
          </button>
          <a
            href={loginPath}
            className="btn border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            Về trang đăng nhập
          </a>
        </div>
        <p className="text-xs text-amber-800/80">
          Nếu vẫn lỗi: mở Docker Desktop rồi chạy{' '}
          <code className="rounded bg-white/80 px-1">docker compose up -d db</code>
        </p>
      </div>
    </main>
  );
}
