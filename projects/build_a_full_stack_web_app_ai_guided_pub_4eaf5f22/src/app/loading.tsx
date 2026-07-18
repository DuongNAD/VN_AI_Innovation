import LoadingScreen from '@/components/LoadingScreen';

/**
 * Splash toàn cục — Next.js hiển thị tự động khi một route segment đang tải.
 * Lấp khoảng "khựng" trắng khi chuyển giữa trang chính và trang đăng nhập
 * (áp dụng cho cả 3 cổng: người dùng, quản lý, quản trị).
 */
export default function Loading() {
  return <LoadingScreen />;
}
