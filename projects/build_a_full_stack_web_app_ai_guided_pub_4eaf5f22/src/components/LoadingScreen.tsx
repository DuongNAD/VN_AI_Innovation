import BrandLogo from '@/components/BrandLogo';

type Props = {
  /** Dòng chữ trạng thái hiển thị dưới spinner */
  label?: string;
  /**
   * true  → chiếm trọn chiều cao màn hình (splash chuyển trang cấp cao).
   * false → lấp vùng nội dung, giữ nguyên chrome bao ngoài (điều hướng nội bộ).
   */
  fullscreen?: boolean;
};

/**
 * Màn hình chờ dùng chung — bắc cầu khoảng trắng khi chuyển trang
 * (đăng nhập ↔ trang chính, và các điều hướng chậm khác).
 * Nền mesh/gradient đã có sẵn ở root layout nên component để nền trong suốt.
 */
export default function LoadingScreen({
  label = 'Đang chuẩn bị…',
  fullscreen = true,
}: Props) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-7 px-4 ${
        fullscreen ? 'min-h-screen' : 'min-h-[60vh] py-16'
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex items-center justify-center">
        <span
          className="absolute h-24 w-24 rounded-full bg-brand-400/20 blur-xl motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <BrandLogo size="lg" iconOnly href={null} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <span
          className="h-7 w-7 rounded-full border-[3px] border-brand-200 border-r-accent-400 border-t-brand-600 motion-safe:animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-slate-600">{label}</p>
      </div>

      <span className="sr-only">Đang tải, vui lòng đợi.</span>
    </div>
  );
}
