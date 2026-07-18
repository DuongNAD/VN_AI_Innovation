import LoadingScreen from '@/components/LoadingScreen';

/**
 * Loader vùng nội dung cho điều hướng nội bộ trong cổng người dùng.
 * Render bên trong khung portal (giữ nguyên thanh UserBar) nên nhẹ hơn
 * splash toàn màn hình — tránh nhấp nháy khi đi lại giữa các trang.
 */
export default function PortalLoading() {
  return <LoadingScreen fullscreen={false} label="Đang tải…" />;
}
